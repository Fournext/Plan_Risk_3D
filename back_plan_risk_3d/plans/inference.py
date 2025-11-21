# plans/inference.py
import os

import numpy as np
import tensorflow as tf
from PIL import Image

from mrcnn.config import Config
from mrcnn.model import MaskRCNN, mold_image
from mrcnn.utils import extract_bboxes


# Config del modelo
class PredictionConfig(Config):
    NAME = "floorPlan_cfg"
    NUM_CLASSES = 1 + 3  # bg + {wall,window,door}
    GPU_COUNT = 1
    IMAGES_PER_GPU = 1

# Carga única del modelo al iniciar el proceso WSGI
ROOT_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..')
)
WEIGHTS_FOLDER = os.path.join(ROOT_DIR, 'weights')
WEIGHTS_FILE_NAME = 'maskrcnn_15_epochs.h5'
MODEL_DIR = os.path.join(ROOT_DIR, 'mrcnn')

_cfg = PredictionConfig()
_model = None
_graph = None


def load_model_once():
    """Cargar modelo Mask R-CNN una sola vez."""
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
    height, width = image.shape[0], image.shape[1]
    scaled = mold_image(image, cfg)
    sample = np.expand_dims(scaled, 0)

    with graph.as_default():
        results = model.detect(sample, verbose=0)[0]

    # Normalizar y convertir resultados
    rois = results['rois'].tolist()
    class_ids = results['class_ids'].tolist()
    classes = [
        {"name": CLASS_ID_TO_NAME.get(cid, str(cid))}
        for cid in class_ids
    ]

    # Calcular promedio de ancho de puerta
    door_diffs = []
    for bbox, cid in zip(results['rois'], class_ids):
        y1, x1, y2, x2 = bbox
        if cid == 3:  # door
            door_diffs.append(max(abs(x2 - x1), abs(y2 - y1)))
    average_door = float(np.mean(door_diffs)) if door_diffs else 0.0

    # Puntos en formato {x1, y1, x2, y2}
    points = [
        {"x1": int(x1), "y1": int(y1), "x2": int(x2), "y2": int(y2)}
        for (y1, x1, y2, x2) in results['rois']
    ]

    return {
        "points": points,
        "classes": classes,
        "Width": width,
        "Height": height,
        "averageDoor": average_door,
        "scores": (
            results.get('scores', []).tolist()
            if results.get('scores') is not None
            else []
        ),
    }
