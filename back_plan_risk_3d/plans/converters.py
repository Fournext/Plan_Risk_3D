# plans/converters.py
import os, shutil, subprocess, tempfile
from typing import Optional, Tuple
from PIL import Image

SUPPORTED_IMAGE_EXT = {'.jpg', '.jpeg', '.png', '.bmp', '.tif', '.tiff', '.webp'}
SUPPORTED_VECTOR_EXT = {'.dxf', '.dwg'}
SUPPORTED_PDF_EXT = {'.pdf'}

def _ext(path: str) -> str:
    return os.path.splitext(path)[1].lower()

def image_from_any(input_path: str) -> Tuple[Optional[Image.Image], Optional[str]]:
    """
    Devuelve (PIL.Image, mensaje_error). Si no pudo rasterizar, Image=None y explica el motivo.
    """
    ext = _ext(input_path)

    # Caso 1: ya es imagen
    if ext in SUPPORTED_IMAGE_EXT:
        try:
            img = Image.open(input_path)
            img.load()
            if img.mode not in ('RGB', 'RGBA'):
                img = img.convert('RGB')
            return img, None
        except Exception as e:
            return None, f"No se pudo abrir la imagen: {e}"

    # Caso 2: PDF -> primera página como imagen
    if ext in SUPPORTED_PDF_EXT:
        try:
            from pdf2image import convert_from_path
        except Exception:
            return None, "Falta dependencia: instale pdf2image y Poppler para PDF."

        try:
            pages = convert_from_path(input_path, dpi=200)  # primera página
            if not pages:
                return None, "PDF sin páginas."
            img = pages[0]
            if img.mode not in ('RGB', 'RGBA'):
                img = img.convert('RGB')
            return img, None
        except Exception as e:
            return None, f"Error al rasterizar PDF: {e}"

    # Caso 3: DXF → render
    if ext == '.dxf':
        try:
            import ezdxf
            from ezdxf.addons.drawing import matplotlib as ezdxf_matplot
            import matplotlib.pyplot as plt
        except Exception:
            return None, "Falta dependencia: instale ezdxf y matplotlib para DXF."

        try:
            doc = ezdxf.readfile(input_path)
            msp = doc.modelspace()
            fig = plt.figure()
            ax = fig.add_axes([0, 0, 1, 1])
            ctx = ezdxf_matplot.MatplotlibBackend(ax)
            ezdxf.addons.drawing.properties.MODEL_SPACE_BG_COLOR = (1,1,1)
            ezdxf.addons.drawing.draw_layout(msp, ctx)
            fig.canvas.draw()
            w, h = fig.canvas.get_width_height()
            buf = fig.canvas.tostring_rgb()
            img = Image.frombytes("RGB", (w, h), buf)
            plt.close(fig)
            return img, None
        except Exception as e:
            return None, f"Error al renderizar DXF: {e}"

    # Caso 4: DWG → convertir a DXF con ODAFileConverter (si existe), luego procesar como DXF
    if ext == '.dwg':
        oda = shutil.which('ODAFileConverter') or shutil.which('ODAFileConverter.exe')
        if not oda:
            return None, "Para DWG necesitas ODAFileConverter instalado y en PATH (DWG→DXF)."
        try:
            tempdir = tempfile.mkdtemp(prefix="dwg2dxf_")
            outdir = os.path.join(tempdir, "out")
            os.makedirs(outdir, exist_ok=True)
            # ODAFileConverter <in> <outdir> <outVer> <outType> <Recurse> <Audit> <ExplodeAciToTrueColor>
            # Ej: ACAD2018 DXF  →  "ACAD2018" "DXF" "0" "0" "0"
            cmd = [oda, os.path.dirname(input_path), outdir, "ACAD2018", "DXF", "0", "0", "0"]
            subprocess.check_call(cmd)
            # buscar el DXF convertido con mismo nombre base
            base = os.path.splitext(os.path.basename(input_path))[0]
            # ODA tiende a mantener nombre. Busca en outdir
            dxf_candidate = None
            for root, _, files in os.walk(outdir):
                for f in files:
                    if f.lower().endswith(".dxf") and os.path.splitext(f)[0].lower() == base.lower():
                        dxf_candidate = os.path.join(root, f)
                        break
            if not dxf_candidate:
                # toma el primer DXF que encuentre
                for root, _, files in os.walk(outdir):
                    for f in files:
                        if f.lower().endswith(".dxf"):
                            dxf_candidate = os.path.join(root, f); break
                    if dxf_candidate: break
            if not dxf_candidate:
                return None, "No se generó DXF desde DWG (ODA)."

            # Reusar pipeline DXF:
            img, err = image_from_any(dxf_candidate)
            return img, err
        except Exception as e:
            return None, f"Error al convertir DWG→DXF con ODA: {e}"

    # Otros formatos: no soportados para inferencia
    return None, f"Formato no soportado para inferencia: {ext}"
