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
EXTERNAL_WALL_MARGIN = 0.08  # 8 cm de margen para detectar muros externos


# Colores RGBA
COLOR_WALL   = [180, 180, 180, 255]
COLOR_DOOR   = [160, 110,  80, 255]
COLOR_WINDOW = [120, 160, 220, 255]

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
    """Devuelve (LineString, orient, roi) por el eje mayor del ROI y extendido JOINT_PAD_M."""
    dx, dy, cx, cy = _roi_dims_center_m(p, px2m)
    if dx >= dy:
        L = dx + 2 * JOINT_PAD_M
        ln = LineString([(cx - L/2.0, cy), (cx + L/2.0, cy)])
        return ln, 'h', p
    else:
        L = dy + 2 * JOINT_PAD_M
        ln = LineString([(cx, cy - L/2.0), (cx, cy + L/2.0)])
        return ln, 'v', p

def _is_external_wall(roi, px2m, img_width, img_height):
    """Detecta si un muro está en el perímetro externo del plano."""
    dx, dy, cx, cy = _roi_dims_center_m(roi, px2m)
    
    # Convertir margen de metros a proporción de la imagen
    margin = EXTERNAL_WALL_MARGIN
    
    # Verificar si está cerca de los bordes (en coordenadas en metros)
    # Asumimos que la imagen también se escala a metros
    x1_m = roi['x1'] * px2m
    x2_m = roi['x2'] * px2m
    y1_m = roi['y1'] * px2m
    y2_m = roi['y2'] * px2m
    width_m = img_width * px2m
    height_m = img_height * px2m
    
    on_left = min(x1_m, x2_m) <= margin
    on_right = max(x1_m, x2_m) >= width_m - margin
    on_top = min(y1_m, y2_m) <= margin
    on_bottom = max(y1_m, y2_m) >= height_m - margin
    
    return on_left or on_right or on_top or on_bottom

def _opening_polygon_from_roi(p, px2m):
    """Rectángulo del vano que atraviesa TODO el espesor del muro (+EPS_CUT)."""
    dx, dy, cx, cy = _roi_dims_center_m(p, px2m)
    t = WALL_THICKNESS_M + 2*EPS_CUT
    if dx >= dy:
        return box(cx - dx/2.0, cy - t/2.0, cx + dx/2.0, cy + t/2.0)
    else:
        return box(cx - t/2.0,   cy - dy/2.0, cx + t/2.0,   cy + dy/2.0)

def _extrude_polygon_union(poly_union):
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
        _colorize(m, COLOR_WALL)
        # reparación del mesh
        m.remove_duplicate_faces()
        m.remove_degenerate_faces()
        m.remove_unreferenced_vertices()
        repair.fix_normals(m)
        m.merge_vertices()
        meshes.append(m)
    return trimesh.util.concatenate(meshes) if meshes else None

def _colorize(mesh: trimesh.Trimesh, rgba):
    mesh.visual.vertex_colors = np.tile(rgba, (len(mesh.vertices), 1))
    return mesh


# ---------- PUERTAS ----------
def _door_mesh_from_roi(p, px2m):
    """
    Puerta como rectángulo directo desde las coordenadas ROI.
    Usa las dimensiones exactas detectadas (dx, dy) y crea un box 3D.
    """
    x1_m = p['x1'] * px2m
    y1_m = p['y1'] * px2m
    x2_m = p['x2'] * px2m
    y2_m = p['y2'] * px2m
    
    # Calcular dimensiones del rectángulo
    width = abs(x2_m - x1_m)
    depth = abs(y2_m - y1_m)
    
    # Centro del rectángulo
    cx = (x1_m + x2_m) * 0.5
    cy = (y1_m + y2_m) * 0.5
    
    # Crear box con las dimensiones exactas del ROI
    ext = [width, depth, DOOR_HEIGHT_M]
    m = trimesh.creation.box(extents=ext)
    m.apply_translation([cx, cy, DOOR_HEIGHT_M * 0.5])
    
    return _colorize(m, COLOR_DOOR)

# ---------- VENTANAS (CRUZ) ----------
def _window_mesh_from_roi(p, px2m):
    """
    Ventana como marco delgado usando las dimensiones del ROI.
    Solo muestra una cruz delgada en la posición de la ventana, sin ocupar todo el grosor del muro.
    """
    x1_m = p['x1'] * px2m
    y1_m = p['y1'] * px2m
    x2_m = p['x2'] * px2m
    y2_m = p['y2'] * px2m
    
    # Dimensiones del ROI
    dx = abs(x2_m - x1_m)
    dy = abs(y2_m - y1_m)
    
    # Centro
    cx = (x1_m + x2_m) * 0.5
    cy = (y1_m + y2_m) * 0.5
    
    parts = []
    z_center = WINDOW_SILL_M + WINDOW_HEIGHT_M * 0.5

    # Determinar orientación del muro
    if dx >= dy:
        # Muro horizontal - la ventana es delgada en Y
        # 1) Bloque inferior
        if WINDOW_SILL_M > 0:
            ext_bottom = [dx, dy, WINDOW_SILL_M]
            b = trimesh.creation.box(extents=ext_bottom)
            b.apply_translation([cx, cy, WINDOW_SILL_M * 0.5])
            _colorize(b, COLOR_WALL)
            parts.append(b)
        
        # 2) Cruz de ventana (delgada)
        # Barra vertical
        ext_v = [WINDOW_BAR_THICK_M, dy, WINDOW_HEIGHT_M]
        v = trimesh.creation.box(extents=ext_v)
        v.apply_translation([cx, cy, z_center])
        _colorize(v, COLOR_WINDOW)
        parts.append(v)
        
        # Barra horizontal
        ext_h = [dx, dy, WINDOW_BAR_THICK_M]
        h = trimesh.creation.box(extents=ext_h)
        h.apply_translation([cx, cy, z_center])
        _colorize(h, COLOR_WINDOW)
        parts.append(h)
        
        # 3) Tapa superior
        top_thick = TOP_CAP_THICK_M
        top_zc = WINDOW_SILL_M + WINDOW_HEIGHT_M + top_thick * 0.5
        top_zc = min(top_zc, WALL_HEIGHT_M - top_thick * 0.5)
        ext_top = [dx, dy, top_thick]
        t = trimesh.creation.box(extents=ext_top)
        t.apply_translation([cx, cy, top_zc])
        _colorize(t, COLOR_WINDOW)
        parts.append(t)
    else:
        # Muro vertical - la ventana es delgada en X
        # 1) Bloque inferior
        if WINDOW_SILL_M > 0:
            ext_bottom = [dx, dy, WINDOW_SILL_M]
            b = trimesh.creation.box(extents=ext_bottom)
            b.apply_translation([cx, cy, WINDOW_SILL_M * 0.5])
            _colorize(b, COLOR_WALL)
            parts.append(b)
        
        # 2) Cruz de ventana (delgada)
        # Barra vertical
        ext_v = [dx, WINDOW_BAR_THICK_M, WINDOW_HEIGHT_M]
        v = trimesh.creation.box(extents=ext_v)
        v.apply_translation([cx, cy, z_center])
        _colorize(v, COLOR_WINDOW)
        parts.append(v)
        
        # Barra horizontal
        ext_h = [dx, dy, WINDOW_BAR_THICK_M]
        h = trimesh.creation.box(extents=ext_h)
        h.apply_translation([cx, cy, z_center])
        _colorize(h, COLOR_WINDOW)
        parts.append(h)
        
        # 3) Tapa superior
        top_thick = TOP_CAP_THICK_M
        top_zc = WINDOW_SILL_M + WINDOW_HEIGHT_M + top_thick * 0.5
        top_zc = min(top_zc, WALL_HEIGHT_M - top_thick * 0.5)
        ext_top = [dx, dy, top_thick]
        t = trimesh.creation.box(extents=ext_top)
        t.apply_translation([cx, cy, top_zc])
        _colorize(t, COLOR_WINDOW)
        parts.append(t)

    return trimesh.util.concatenate(parts)

# ---------- Orquestador ----------
def build_scene_mesh(det_json: dict, min_score=0.0, cut_openings=True):
    """
    Muros como rectángulos directos desde las coordenadas ROI:
      - Cada muro se crea como un box() directamente desde x1,y1,x2,y2
      - Los muros externos tienen mayor espesor
      - (opcional) resta de vanos
      - extrusión y reparación de mesh
      - Cada muro tiene su propio identificador en la escena
    """
    px2m = _pixel_to_meter_from_det(det_json, fallback=0.01)
    img_width = det_json.get("Width", 1000)
    img_height = det_json.get("Height", 1000)

    walls = []  # Lista de tuplas (polygon, is_external, wall_index)
    opening_polys = []
    doors, windows = [], []
    wall_index = 0

    for roi, name, sc in _iter_rois(det_json):
        if sc < min_score:
            continue
        if name == "wall":
            # Convertir ROI a rectángulo en metros
            x1_m = roi['x1'] * px2m
            y1_m = roi['y1'] * px2m
            x2_m = roi['x2'] * px2m
            y2_m = roi['y2'] * px2m
            
            # Crear rectángulo directamente desde las coordenadas
            wall_box = box(min(x1_m, x2_m), min(y1_m, y2_m), 
                          max(x1_m, x2_m), max(y1_m, y2_m))
            
            # Clasificar si es muro externo o interno
            is_external = _is_external_wall(roi, px2m, img_width, img_height)
            walls.append((wall_box, is_external, wall_index))
            wall_index += 1
                
        elif name == "door":
            doors.append(_door_mesh_from_roi(roi, px2m))
            if cut_openings:
                opening_polys.append(_opening_polygon_from_roi(roi, px2m))
        elif name == "window":
            win = _window_mesh_from_roi(roi, px2m)
            if isinstance(win, trimesh.Trimesh):
                windows.append(win)
            if cut_openings:
                opening_polys.append(_opening_polygon_from_roi(roi, px2m))

    if not walls:
        return None

    scene = trimesh.Scene()

    # Crear mesh individual para cada muro
    for wall_poly, is_external, w_idx in walls:
        # Aplicar recortes de vanos si está habilitado
        final_wall_poly = wall_poly
        if cut_openings and opening_polys:
            openings_union = unary_union(opening_polys).buffer(0)
            final_wall_poly = wall_poly.difference(openings_union)
            final_wall_poly = final_wall_poly.buffer(0)

        # Crear mesh individual
        wall_mesh = _extrude_polygon_union(final_wall_poly)
        if wall_mesh is not None:
            # Nombre específico según tipo de muro
            wall_type = "external" if is_external else "internal"
            node_name = f"wall_{wall_type}_{w_idx}"
            scene.add_geometry(wall_mesh, node_name=node_name)

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