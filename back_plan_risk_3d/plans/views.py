# plans/views.py
import io, json, os
from PIL import Image
from django.conf import settings
from rest_framework import status, views
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from django.core.files import File
from .models import Plan3DJob
from .serializers import Plan3DJobSerializer
from .inference import run_inference
from .three import build_scene_mesh, export_glb
from .converters import image_from_any

class PlanCreateView(views.APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, format=None):
        # aceptar cualquier archivo vía 'plan_file'
        ser = Plan3DJobSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        job = ser.save()  # guarda en media/inputs/

        # 1) Rasterizar si es necesario (PDF/DXF/DWG), o abrir imagen directa
        img, err = image_from_any(job.plan_file.path)
        if img is None:
            # guardamos el archivo de todos modos; pero no podemos inferir
            # puedes devolver 415 o 400 con mensaje claro
            return Response(
                {"detail": f"No se pudo preparar la imagen para inferencia: {err}"},
                status=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
            )

        # guarda la imagen rasterizada en media/inputs/rasterized/
        raster_dir = os.path.join(settings.MEDIA_ROOT, 'inputs', 'rasterized')
        os.makedirs(raster_dir, exist_ok=True)
        raster_path = os.path.join(raster_dir, f'job_{job.id}_raster.png')
        img.save(raster_path)
        # enlazar a plan_image
        with open(raster_path, 'rb') as fh:
            job.plan_image.save(os.path.basename(raster_path), File(fh), save=False)

        # 2) inferencia
        det = run_inference(img)

        # 3) guardar JSON
        outputs_dir = os.path.join(settings.MEDIA_ROOT, 'outputs')
        os.makedirs(outputs_dir, exist_ok=True)
        json_path = os.path.join(outputs_dir, f'job_{job.id}_detections.json')
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(det, f, ensure_ascii=False)

        # 4) generar .glb (extrusión simple de “wall”)
        mesh = build_scene_mesh(det, min_score=0.0)  # puedes subir min_score a 0.5 si hay mucho ruido
        glb_path = None
        if mesh is not None:
            glb_path = os.path.join(outputs_dir, f'job_{job.id}.glb')
            export_glb(mesh, glb_path)

        # 5) actualizar modelo
        job.width = det.get("Width", 0)
        job.height = det.get("Height", 0)
        with open(json_path, 'rb') as fh:
            job.detections_json.save(os.path.basename(json_path), File(fh), save=False)
        if glb_path:
            with open(glb_path, 'rb') as fh:
                job.glb_model.save(os.path.basename(glb_path), File(fh), save=False)
        job.save()

        return Response(Plan3DJobSerializer(job).data, status=status.HTTP_201_CREATED)
