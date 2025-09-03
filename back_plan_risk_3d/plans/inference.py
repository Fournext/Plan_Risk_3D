# plans/inference.py
import os
import numpy as np
from PIL import Image
import tensorflow as tf

from mrcnn.config import Config
from mrcnn.model import MaskRCNN, mold_image
from mrcnn.utils import extract_bboxes

# === Config del modelo (tu PredictionConfig) ===
class PredictionConfig(Config):
    NAME = "floorPlan_cfg"
    NUM_CLASSES = 1 + 3  # bg + {wall,window,door}
    GPU_COUNT = 1
    IMAGES_PER_GPU = 1

# === Carga única del modelo al iniciar el proceso WSGI ===
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
WEIGHTS_FOLDER = os.path.join(ROOT_DIR, 'weights')
WEIGHTS_FILE_NAME = 'maskrcnn_15_epochs.h5'
MODEL_DIR = os.path.join(ROOT_DIR, 'mrcnn')

_cfg = PredictionConfig()
_model = None
_graph = None

def load_model_once():
    global _model, _graph
    if _model is None:
        weights_path = os.path.join(WEIGHTS_FOLDER, WEIGHTS_FILE_NAME)
        _model = MaskRCNN(mode='inference', model_dir=MODEL_DIR, config=_cfg)
        _model.load_weights(weights_path, by_name=True)
        _graph = tf.get_default_graph()  # TF1.x
    return _model, _graph, _cfg

CLASS_ID_TO_NAME = {1: "wall", 2: "window", 3: "door"}

def _pil_to_rgb_np(img: Image.Image):
    arr = np.asarray(img)
    if arr.ndim != 3:
        # a RGB (como haces en Flask)
        from skimage import color
        arr = color.gray2rgb(arr)
    if arr.shape[-1] == 4:
        arr = arr[..., :3]
    return arr

def run_inference(pil_image: Image.Image):
    model, graph, cfg = load_model_once()
    image = _pil_to_rgb_np(pil_image)
    h, w = image.shape[0], image.shape[1]
    scaled = mold_image(image, cfg)
    sample = np.expand_dims(scaled, 0)

    with graph.as_default():
        r = model.detect(sample, verbose=0)[0]

    # Normaliza/convierte como en Flask
    rois = r['rois'].tolist()
    class_ids = r['class_ids'].tolist()
    classes = [{"name": CLASS_ID_TO_NAME.get(cid, str(cid))} for cid in class_ids]

    # ejemplo simple de promedio de “ancho de puerta”
    door_diffs = []
    for bb, cid in zip(r['rois'], class_ids):
        y1, x1, y2, x2 = bb
        if cid == 3:  # door
            door_diffs.append(max(abs(x2 - x1), abs(y2 - y1)))
    averageDoor = float(np.mean(door_diffs)) if door_diffs else 0.0

    # puntos en formato {x1,y1,x2,y2}
    points = [{"x1": int(x1), "y1": int(y1), "x2": int(x2), "y2": int(y2)}
              for (y1, x1, y2, x2) in r['rois']]

    return {
        "points": points,
        "classes": classes,
        "Width": w,
        "Height": h,
        "averageDoor": averageDoor,
        # además devolvemos masks y scores por si quieres usarlos
        "scores": r.get('scores', []).tolist() if r.get('scores') is not None else [],
    }
