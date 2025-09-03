# sitecustomize.py — se importa automáticamente después de 'site'
import os
try:
    add = os.add_dll_directory  # solo en Windows + Python 3.8+
except AttributeError:
    add = None

conda = os.environ.get('CONDA_PREFIX')
if add and conda:
    for rel in ("Library\\bin", "DLLs", "Library\\usr\\bin", "Library\\mingw-w64\\bin", "bin"):
        path = os.path.join(conda, rel)
        if os.path.isdir(path):
            try:
                add(path)
            except Exception:
                pass
