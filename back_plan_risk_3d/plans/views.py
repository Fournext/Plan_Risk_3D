# plans/views.py
import io, json
from PIL import Image
from django.conf import settings
from rest_framework import status, views
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from django.core.files.base import ContentFile

from .models import Plan3DJob
from .serializers import Plan3DJobSerializer
from .inference import run_inference
from .three import build_scene_mesh_clean, export_glb
from .converters import image_from_any

class PlanCreateView(views.APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, format=None):
        # 1) Guardar SOLO el archivo de entrada (Django lo pone en media/inputs/)
        ser = Plan3DJobSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        job = ser.save()

        # 2) Convertir a imagen si hace falta (PDF/DXF/DWG) SIN escribir a disco
        img, err = image_from_any(job.plan_file.path)
        if img is None:
            return Response(
                {"detail": f"No se pudo preparar la imagen para inferencia: {err}"},
                status=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
            )

        # 3) Guardar la imagen rasterizada en memoria (plan_image) — sin open()
        png_buf = io.BytesIO()
        img.save(png_buf, format='PNG')
        job.plan_image.save(f'job_{job.id}_raster.png',
                            ContentFile(png_buf.getvalue()), save=False)

        # 4) Inferencia
        det = run_inference(img)

        # 5) Guardar JSON en memoria (una sola vez)
        json_bytes = json.dumps(det, ensure_ascii=False).encode('utf-8')
        job.detections_json.save(f'job_{job.id}_detections.json',
                                 ContentFile(json_bytes), save=False)

        # 6) Generar GLB en memoria y guardar (una sola vez)
        mesh = build_scene_mesh_clean(det, min_score=0.0, cut_openings=True)
        if mesh is not None:
            glb_buf = io.BytesIO()
            export_glb(mesh, glb_buf)  # << escribe al buffer
            job.glb_model.save(f'job_{job.id}.glb',
                               ContentFile(glb_buf.getvalue()), save=False)

        # 7) Metadatos y respuesta
        job.width = det.get("Width", 0)
        job.height = det.get("Height", 0)
        job.save()

        return Response(Plan3DJobSerializer(job).data, status=status.HTTP_201_CREATED)
