# plans/converters.py
import os
import shutil
import subprocess
import tempfile
from typing import Optional, Tuple

from PIL import Image

SUPPORTED_IMAGE_EXT = {
    '.jpg', '.jpeg', '.png', '.bmp', '.tif', '.tiff', '.webp'
}
SUPPORTED_VECTOR_EXT = {'.dxf', '.dwg'}
SUPPORTED_PDF_EXT = {'.pdf'}


def _ext(path: str) -> str:
    """Extraer extensión del archivo en minúsculas."""
    return os.path.splitext(path)[1].lower()


def image_from_any(input_path: str) -> Tuple[Optional[Image.Image],
                                              Optional[str]]:
    """
    Convertir archivo a imagen PIL.

    Args:
        input_path: Ruta al archivo (imagen, PDF, DXF, DWG)

    Returns:
        Tupla de (PIL.Image, mensaje_error)
        Si no pudo rasterizar, Image=None y explica el motivo.
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
            msg = "Falta dependencia: instale pdf2image y Poppler para PDF."
            return None, msg

        try:
            # Primera página
            pages = convert_from_path(input_path, dpi=200)
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
            import ezdxf.addons.drawing
            from ezdxf.addons.drawing import matplotlib as ezdxf_matplot
            import matplotlib.pyplot as plt
        except Exception:
            msg = "Falta dependencia: instale ezdxf y matplotlib para DXF."
            return None, msg

        try:
            doc = ezdxf.readfile(input_path)
            msp = doc.modelspace()
            fig = plt.figure()
            ax = fig.add_axes([0, 0, 1, 1])
            ctx = ezdxf_matplot.MatplotlibBackend(ax)
            ezdxf.addons.drawing.properties.MODEL_SPACE_BG_COLOR = (1, 1, 1)
            ezdxf.addons.drawing.draw_layout(msp, ctx)
            fig.canvas.draw()
            width, height = fig.canvas.get_width_height()
            buf = fig.canvas.tostring_rgb()
            img = Image.frombytes("RGB", (width, height), buf)
            plt.close(fig)
            return img, None
        except Exception as e:
            return None, f"Error al renderizar DXF: {e}"

    # Caso 4: DWG → convertir a DXF con ODAFileConverter
    if ext == '.dwg':
        oda = (
            shutil.which('ODAFileConverter') or
            shutil.which('ODAFileConverter.exe')
        )
        if not oda:
            msg = (
                "Para DWG necesitas ODAFileConverter "
                "instalado y en PATH (DWG→DXF)."
            )
            return None, msg
        try:
            tempdir = tempfile.mkdtemp(prefix="dwg2dxf_")
            outdir = os.path.join(tempdir, "out")
            os.makedirs(outdir, exist_ok=True)
            # ODAFileConverter: ACAD2018 DXF
            cmd = [
                oda,
                os.path.dirname(input_path),
                outdir,
                "ACAD2018",
                "DXF",
                "0",
                "0",
                "0"
            ]
            subprocess.check_call(cmd)

            # Buscar el DXF convertido con mismo nombre base
            base = os.path.splitext(os.path.basename(input_path))[0]
            dxf_candidate = None
            for root, _, files in os.walk(outdir):
                for filename in files:
                    if (filename.lower().endswith(".dxf") and
                            os.path.splitext(filename)[0].lower() ==
                            base.lower()):
                        dxf_candidate = os.path.join(root, filename)
                        break

            # Si no encuentra, toma el primer DXF
            if not dxf_candidate:
                for root, _, files in os.walk(outdir):
                    for filename in files:
                        if filename.lower().endswith(".dxf"):
                            dxf_candidate = os.path.join(root, filename)
                            break
                    if dxf_candidate:
                        break
            if not dxf_candidate:
                return None, "No se generó DXF desde DWG (ODA)."

            # Reutilizar pipeline DXF
            img, err = image_from_any(dxf_candidate)
            return img, err
        except Exception as e:
            return None, f"Error al convertir DWG→DXF con ODA: {e}"

    # Otros formatos no soportados
    return None, f"Formato no soportado para inferencia: {ext}"
