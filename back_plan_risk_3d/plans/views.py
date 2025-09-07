# plans/views.py
import io, json
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from django.core.files.base import ContentFile

from .serializers import Plan3DJobSerializer


def process_and_save_glb(job, det):
    """
    Paso 6 y 7: Generar GLB en memoria, guardar, actualizar metadatos y guardar el job.
    """
    from .three import build_scene_mesh, export_glb
    mesh = build_scene_mesh(det, min_score=0.0, cut_openings=True)
    if mesh is not None:
        glb_buf = io.BytesIO()
        export_glb(mesh, glb_buf)
        job.glb_model.save(f'job_{job.id}.glb', ContentFile(glb_buf.getvalue()), save=False)
    job.width = det.get("Width", 0)
    job.height = det.get("Height", 0)
    job.save()
    return job


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def create_plan3d_job(request):
    # 1) Guardar SOLO el archivo de entrada (Django lo pone en media/inputs/)
    ser = Plan3DJobSerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
    job = ser.save()

    # 2) Convertir a imagen si hace falta (PDF/DXF/DWG) SIN escribir a disco
    from .converters import image_from_any
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
    from .inference import run_inference
    det = run_inference(img)

    # 5) Guardar JSON en memoria (una sola vez)
    json_bytes = json.dumps(det, ensure_ascii=False).encode('utf-8')
    job.detections_json.save(f'job_{job.id}_detections.json',
                             ContentFile(json_bytes), save=False)

    # 6 y 7) Generar GLB, guardar y metadatos
    process_and_save_glb(job, det)

    return Response(Plan3DJobSerializer(job).data, status=status.HTTP_201_CREATED)

# POST: Ejemplo de otra función POST separada

@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def create_plan_json(request):
    # Espera un archivo .json en el campo 'plan_file' del request
    json_file = request.FILES.get('plan_file')
    if not json_file or not json_file.name.endswith('.json'):
        return Response({'detail': 'Se requiere un archivo .json en el campo "plan_file".'}, status=status.HTTP_400_BAD_REQUEST)

    # Guardar el archivo en media/inputs/ (usando Plan3DJob para mantener consistencia)
    ser = Plan3DJobSerializer(data=request.data)
    if not ser.is_valid():
        print(ser.errors)
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
    job = ser.save()

    # Guardar el archivo json en el campo detections_json
    job.detections_json.save(f'job_{job.id}_detections.json', json_file, save=False)

    # Leer el contenido del JSON para procesar
    json_file.seek(0)
    try:
        det = json.load(json_file)
    except Exception as e:
        return Response({'detail': f'Error al leer el JSON: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

    # 6 y 7) Generar GLB, guardar y metadatos
    process_and_save_glb(job, det)

    return Response(Plan3DJobSerializer(job).data, status=status.HTTP_201_CREATED)
