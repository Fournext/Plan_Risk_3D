# plans/three.py
import numpy as np
import trimesh

# === Parámetros ===
WALL_HEIGHT_M = 3.0
WALL_THICKNESS_M = 0.15

DOOR_HEIGHT_M = 2.10
DOOR_THICKNESS_M = 0.10

WINDOW_HEIGHT_M = 1.20
WINDOW_SILL_M   = 0.90
WINDOW_THICKNESS_M = 0.08

# Colores RGBA (se exportan como vertex colors en GLB)
COLOR_WALL   = [180, 180, 180, 255]
COLOR_DOOR   = [160, 110,  80, 255]
COLOR_WINDOW = [120, 160, 220, 255]

def _pixel_to_meter_from_det(det: dict, fallback=0.01):
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
    dx = abs(x2 - x1) * px2m
    dy = abs(y2 - y1) * px2m
    cx = (x1 + x2) * 0.5 * px2m
    cy = (y1 + y2) * 0.5 * px2m
    return dx, dy, cx, cy

def _colorize(mesh: trimesh.Trimesh, rgba):
    mesh.visual.vertex_colors = np.tile(rgba, (len(mesh.vertices), 1))
    return mesh

def _wall_mesh_from_roi(p, px2m):
    dx, dy, cx, cy = _roi_dims_center_m(p, px2m)
    # Muro orientado por el eje mayor: el eje menor es el espesor real
    if dx >= dy:
        ext = [dx, WALL_THICKNESS_M, WALL_HEIGHT_M]   # horizontal
    else:
        ext = [WALL_THICKNESS_M, dy, WALL_HEIGHT_M]   # vertical
    m = trimesh.creation.box(extents=ext)
    m.apply_translation([cx, cy, WALL_HEIGHT_M * 0.5])
    return _colorize(m, COLOR_WALL)

def _door_mesh_from_roi(p, px2m):
    dx, dy, cx, cy = _roi_dims_center_m(p, px2m)
    if dx >= dy:
        ext = [dx, DOOR_THICKNESS_M, DOOR_HEIGHT_M]   # ancho en X
        # empuja hacia fuera de la cara del muro (eje Y)
        offset = [0,  + (WALL_THICKNESS_M/2 + 0.005), 0]
    else:
        ext = [DOOR_THICKNESS_M, dy, DOOR_HEIGHT_M]   # ancho en Y
        offset = [ + (WALL_THICKNESS_M/2 + 0.005), 0, 0]
    m = trimesh.creation.box(extents=ext)
    m.apply_translation([cx, cy, DOOR_HEIGHT_M * 0.5])
    m.apply_translation(offset)  # saca la puerta a la cara del muro
    return _colorize(m, COLOR_DOOR)

def _window_mesh_from_roi(p, px2m):
    dx, dy, cx, cy = _roi_dims_center_m(p, px2m)
    if dx >= dy:
        ext = [dx, WINDOW_THICKNESS_M, WINDOW_HEIGHT_M]
        offset = [0,  + (WALL_THICKNESS_M/2 + 0.005), 0]
    else:
        ext = [WINDOW_THICKNESS_M, dy, WINDOW_HEIGHT_M]
        offset = [ + (WALL_THICKNESS_M/2 + 0.005), 0, 0]
    m = trimesh.creation.box(extents=ext)
    zc = WINDOW_SILL_M + WINDOW_HEIGHT_M * 0.5
    m.apply_translation([cx, cy, zc])
    m.apply_translation(offset)  # saca la ventana a la cara del muro
    return _colorize(m, COLOR_WINDOW)

def build_scene_mesh(det_json: dict, min_score=0.0):
    """
    Devuelve un Scene con MUROS + PUERTAS + VENTANAS coloreados.
    """
    px2m = _pixel_to_meter_from_det(det_json, fallback=0.01)

    walls, doors, windows = [], [], []
    for roi, name, sc in _iter_rois(det_json):
        if sc < min_score:
            continue
        if name == "wall":
            walls.append(_wall_mesh_from_roi(roi, px2m))
        elif name == "door":
            doors.append(_door_mesh_from_roi(roi, px2m))
        elif name == "window":
            windows.append(_window_mesh_from_roi(roi, px2m))

    parts = walls + doors + windows
    if not parts:
        return None

    # Devuelve Scene para conservar colores por “nodo”
    scene = trimesh.Scene()
    for i, m in enumerate(parts):
        scene.add_geometry(m, node_name=f"part_{i}")
    return scene

def export_glb(geom, out_path: str):
    # Scene o Trimesh, ambos exportan a GLB
    geom.export(out_path)
