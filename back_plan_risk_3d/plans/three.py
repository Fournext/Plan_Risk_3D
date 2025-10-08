# plans/three.py
import numpy as np
import trimesh
from trimesh.transformations import rotation_matrix
from shapely.geometry import LineString, box, Polygon, MultiPolygon
from shapely.ops import unary_union, snap, polygonize
import trimesh.repair as repair

# ===== Parámetros globales =====
WALL_HEIGHT_M      = 3.0
WALL_THICKNESS_M   = 0.15

DOOR_HEIGHT_M      = WALL_HEIGHT_M
# la puerta tendrá el MISMO espesor que el muro
# (para evitar z-fighting mantenemos un epsilon de separación)
EPS_NORMAL         = 0.000  # 1 mm

WINDOW_SILL_M      = 0.90
WINDOW_HEIGHT_M    =  WALL_HEIGHT_M - WINDOW_SILL_M

# "grosor" de las barras de la cruz
WINDOW_BAR_THICK_M = 0.03

# grosor de la línea/tapa superior (3 cm)
TOP_CAP_THICK_M = 0.03 

# Tolerancias (en metros)
JOINT_PAD_M   = 0.02   # alarga 2 cm los tramos para que las juntas cierren
EPS_CUT       = 0.003  # 3 mm de margen al recortar vanos
TOL_SIMPLIFY  = 0.002  # 2 mm para simplificar contornos
TOL_SNAP      = 0.004  # 4 mm para "pegar" vértices cercanos

"""
# Colores RGBA
COLOR_WALL   = [180, 180, 180, 255]
COLOR_DOOR   = [160, 110,  80, 255]
COLOR_WINDOW = [120, 160, 220, 255]*/
"""
def _pixel_to_meter_from_det(det: dict, fallback=0.01):
    """Escala a metros usando averageDoor si existe (asumimos 0.90 m de ancho puerta)."""
    avg = float(det.get("averageDoor") or 0.0)
    return (0.90 / avg) if avg > 4 else fallback

def _iter_rois(det):
    pts = det.get("points", [])
    cls = det.get("classes", [])
    scr = det.get("scores", []) or [1.0] * len(pts)
    for i, p in enumerate(pts):
        name = (cls[i] or {}).get("name", "")
        score = scr[i] if i < len(scr) else 1.0
        yield p, name, float(score)

def _roi_dims_center_m(p, px2m):
    x1, y1, x2, y2 = p["x1"], p["y1"], p["x2"], p["y2"]
    dx = abs(x2 - x1) * px2m   # ancho en X
    dy = abs(y2 - y1) * px2m   # ancho en Y
    cx = (x1 + x2) * 0.5 * px2m
    cy = (y1 + y2) * 0.5 * px2m
    return dx, dy, cx, cy

def _wall_centerline_from_roi(p, px2m):
    """Devuelve (LineString, orient) por el eje mayor del ROI y extendido JOINT_PAD_M."""
    dx, dy, cx, cy = _roi_dims_center_m(p, px2m)
    if dx >= dy:
        L = dx + 2 * JOINT_PAD_M
        ln = LineString([(cx - L/2.0, cy), (cx + L/2.0, cy)])
        return ln, 'h'
    else:
        L = dy + 2 * JOINT_PAD_M
        ln = LineString([(cx, cy - L/2.0), (cx, cy + L/2.0)])
        return ln, 'v'

def _opening_polygon_from_roi(p, px2m):
    """Rectángulo del vano que atraviesa TODO el espesor del muro (+EPS_CUT)."""
    dx, dy, cx, cy = _roi_dims_center_m(p, px2m)
    t = WALL_THICKNESS_M + 2*EPS_CUT
    if dx >= dy:
        return box(cx - dx/2.0, cy - t/2.0, cx + dx/2.0, cy + t/2.0)
    else:
        return box(cx - t/2.0,   cy - dy/2.0, cx + t/2.0,   cy + dy/2.0)

def _extrude_polygon_union(poly_union,color=None):
    """Extruye a mesh único y lo repara para evitar caras duplicadas y z-fighting."""
    if poly_union.is_empty:
        return None
    polys = [poly_union] if isinstance(poly_union, Polygon) else list(poly_union.geoms)
    meshes = []
    for poly in polys:
        clean = poly.buffer(0)
        if clean.is_empty:
            continue
        m = trimesh.creation.extrude_polygon(clean, height=WALL_HEIGHT_M)
        _colorize(m, color)
        # reparación del mesh
        m.remove_duplicate_faces()
        m.remove_degenerate_faces()
        m.remove_unreferenced_vertices()
        repair.fix_normals(m)
        m.merge_vertices()
        meshes.append(m)
    return trimesh.util.concatenate(meshes) if meshes else None

def _colorize(mesh: trimesh.Trimesh, rgba=None):
    if rgba is None:
        rgba = [200, 200, 200, 255]  # color por defecto
    mesh.visual.vertex_colors = np.tile(rgba, (len(mesh.vertices), 1))
    return mesh


# ---------- PUERTAS ----------
def _door_mesh_from_roi(p, px2m,color=None):
    """
    Puerta con el MISMO espesor que el muro:
      - Si el muro es horizontal: puerta extents = [ancho_X, espesor_muro, altura_puerta]
      - Si el muro es vertical  : puerta extents = [espesor_muro, ancho_Y, altura_puerta]
    La "sacamos" 1 mm hacia afuera para evitar z-fighting.
    """
    dx, dy, cx, cy = _roi_dims_center_m(p, px2m)
    if dx >= dy:  # muro horizontal -> normal en Y
        ext = [max(dx, 1e-4), WALL_THICKNESS_M, DOOR_HEIGHT_M]
        offset = [0, +EPS_NORMAL, 0]
    else:         # muro vertical   -> normal en X
        ext = [WALL_THICKNESS_M, max(dy, 1e-4), DOOR_HEIGHT_M]
        offset = [+EPS_NORMAL, 0, 0]
    m = trimesh.creation.box(extents=ext)
    m.apply_translation([cx, cy, DOOR_HEIGHT_M * 0.5])
    m.apply_translation(offset)
    return _colorize(m, color)

# ---------- VENTANAS (CRUZ) ----------
def _window_mesh_from_roi(p, px2m,color_window=None, color_wall=None):
    """
    Ventana con:
      - cruz (vertical + horizontal) como antes,
      - bloque inferior (relleno bajo la ventana) del color de muro,
      - tapa superior (línea fina) justo sobre la ventana.
    Todo con profundidad = espesor del muro y un pequeño offset para evitar z-fighting.
    """
    dx, dy, cx, cy = _roi_dims_center_m(p, px2m)
    z_center = WINDOW_SILL_M + WINDOW_HEIGHT_M * 0.5
    parts = []

    # ----- orientación y normal del muro -----
    if dx >= dy:
        # muro "horizontal": la normal está en Y
        normal_offset = [0, +EPS_NORMAL, 0]

        # 1) Cruz (color de ventana)
        # barra vertical
        ext_v = [WINDOW_BAR_THICK_M, WALL_THICKNESS_M, WINDOW_HEIGHT_M]
        v = trimesh.creation.box(extents=ext_v)
        v.apply_translation([cx, cy, z_center])
        v.apply_translation(normal_offset)
        _colorize(v, color_window)
        parts.append(v)

        # barra horizontal
        width = max(dx, WINDOW_BAR_THICK_M * 2)
        ext_h = [width, WALL_THICKNESS_M, WINDOW_BAR_THICK_M]
        h = trimesh.creation.box(extents=ext_h)
        h.apply_translation([cx, cy, z_center])
        h.apply_translation(normal_offset)
        _colorize(h, color_window)
        parts.append(h)

        # 2) Bloque inferior (relleno bajo la ventana) - color de muro
        if WINDOW_SILL_M > 0:
            ext_bottom = [dx, WALL_THICKNESS_M, WINDOW_SILL_M]
            b = trimesh.creation.box(extents=ext_bottom)
            b.apply_translation([cx, cy, WINDOW_SILL_M * 0.5])
            b.apply_translation(normal_offset)
            _colorize(b, color_wall)
            parts.append(b)
##------------posible error desde aqui hasta +12 lineas
        # 3) Tapa superior (línea fina justo arriba)
        top_thick = TOP_CAP_THICK_M
        top_zc = WINDOW_SILL_M + WINDOW_HEIGHT_M + top_thick * 0.5
        # opcional: no pasar del alto del muro
        top_zc = min(top_zc, WALL_HEIGHT_M - top_thick * 0.5)

        ext_top = [dx, WALL_THICKNESS_M, top_thick]
        t = trimesh.creation.box(extents=ext_top)
        t.apply_translation([cx, cy, top_zc])
        t.apply_translation(normal_offset)
        _colorize(t, color_window)
        parts.append(t)

    else:
        # muro "vertical": la normal está en X
        normal_offset = [+EPS_NORMAL, 0, 0]

        # 1) Cruz (color de ventana)
        # barra vertical
        ext_v = [WALL_THICKNESS_M, WINDOW_BAR_THICK_M, WINDOW_HEIGHT_M]
        v = trimesh.creation.box(extents=ext_v)
        v.apply_translation([cx, cy, z_center])
        v.apply_translation(normal_offset)
        _colorize(v, color_window)
        parts.append(v)

        # barra horizontal
        width = max(dy, WINDOW_BAR_THICK_M * 2)
        ext_h = [WALL_THICKNESS_M, width, WINDOW_BAR_THICK_M]
        h = trimesh.creation.box(extents=ext_h)
        h.apply_translation([cx, cy, z_center])
        h.apply_translation(normal_offset)
        _colorize(h, color_window)
        parts.append(h)

        # 2) Bloque inferior (relleno bajo la ventana) - color de muro
        if WINDOW_SILL_M > 0:
            ext_bottom = [WALL_THICKNESS_M, dy, WINDOW_SILL_M]
            b = trimesh.creation.box(extents=ext_bottom)
            b.apply_translation([cx, cy, WINDOW_SILL_M * 0.5])
            b.apply_translation(normal_offset)
            _colorize(b, color_wall)
            parts.append(b)
##------------posible error hasta aqui +11 lineas
        # 3) Tapa superior (línea fina)
        top_thick = TOP_CAP_THICK_M
        top_zc = WINDOW_SILL_M + WINDOW_HEIGHT_M + top_thick * 0.5
        top_zc = min(top_zc, WALL_HEIGHT_M - top_thick * 0.5)

        ext_top = [WALL_THICKNESS_M, dy, top_thick]
        t = trimesh.creation.box(extents=ext_top)
        t.apply_translation([cx, cy, top_zc])
        t.apply_translation(normal_offset)
        _colorize(t, color_window)
        parts.append(t)

    # Unir piezas de la ventana
    return trimesh.util.concatenate(parts)

# ---------- Orquestador ----------
def build_scene_mesh(det_json: dict, min_score=0.0, cut_openings=True,colors=None):
    """
    Muros SIN solapes:
      - ROI -> Línea central
      - buffer espesor/2 con uniones BEVEL (join_style=3) y extremos cuadrados (cap_style=2)
      - snap + simplify para pegar vértices casi coincidentes y eliminar picos
      - (opcional) resta de vanos
      - extrusión y reparación de mesh
    """
    colors = colors or {
        "wall": [180, 180, 180, 255],
        "door": [160, 110, 80, 255],
        "window": [120, 160, 220, 255]
    }
    px2m = _pixel_to_meter_from_det(det_json, fallback=0.01)

    wall_lines = []
    opening_polys = []
    doors, windows = [], []

    for roi, name, sc in _iter_rois(det_json):
        if sc < min_score:
            continue
        if name == "wall":
            ln, _ = _wall_centerline_from_roi(roi, px2m)
            wall_lines.append(ln)
        elif name == "door":
            doors.append(_door_mesh_from_roi(roi, px2m,colors.get("door")))
            if cut_openings:
                opening_polys.append(_opening_polygon_from_roi(roi, px2m))
        elif name == "window":
            win = _window_mesh_from_roi(roi, px2m,color_windw=colors.get("window"), color_wall=colors.get("wall"))
            if isinstance(win, trimesh.Trimesh):
                windows.append(win)
            if cut_openings:
                opening_polys.append(_opening_polygon_from_roi(roi, px2m))

    if not wall_lines:
        return None

    # 1) Unir todos los ejes de muro en un MultiLineString y hacer snap global
    from shapely.geometry import MultiLineString
    if len(wall_lines) == 1:
        merged_lines = wall_lines[0]
    else:
        merged_lines = MultiLineString(wall_lines)
    
    # 2) Crear un polígono unificado a partir de todas las líneas
    # Primero unimos todas las líneas y luego creamos un polígono a partir de ellas
    walls_union = unary_union(merged_lines)
    
    # 3) Aplicar buffer para crear el grosor de las paredes
    walls_union = walls_union.buffer(WALL_THICKNESS_M/2.0, cap_style=2, join_style=2)
    
    # 4) Simplificar y limpiar la geometría
    walls_union = walls_union.simplify(TOL_SIMPLIFY, preserve_topology=True).buffer(0)
    walls_union = snap(walls_union, walls_union, TOL_SNAP).buffer(0)

    # 5) resta de vanos (si aplica) + limpieza
    if cut_openings and opening_polys:
        openings_union = unary_union(opening_polys).buffer(0)
        walls_union = walls_union.difference(openings_union).buffer(0)
        ##walls_union = walls_union.buffer(0)

    # 6) extrusión y reparación
    walls_mesh = _extrude_polygon_union(walls_union,color=colors.get("wall"))

    scene = trimesh.Scene()
    if walls_mesh is not None:
        scene.add_geometry(walls_mesh, node_name="walls")

    for i, m in enumerate(doors):
        scene.add_geometry(m, node_name=f"door_{i}")
    for i, m in enumerate(windows):
        scene.add_geometry(m, node_name=f"window_{i}")

    return scene if len(scene.geometry) > 0 else None

# ---------- Export con rotación Y-up ----------
def export_glb(geom, out: str, make_y_up: bool = True):
    """
    Exporta .glb. Si make_y_up=True rota -90° en X (Z-up -> Y-up) para que quede horizontal.
    """
    if make_y_up:
        R = rotation_matrix(np.deg2rad(-90.0), [1, 0, 0])
        geom.apply_transform(R)
    
    if hasattr(out, "write"):
        geom.export(out, file_type='glb')
    else:
        # Es una ruta
        geom.export(out)