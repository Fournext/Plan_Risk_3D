# plans/views.py
import io, json
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.core.files.base import ContentFile
from mrcnn import views
from plans.models import Plan3DJob
from users.models import Usuario 
from .serializers import Plan3DJobSerializer
from rest_framework.decorators import permission_classes


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


    # 5.1) Asociar el job con el usuario
    usuario_id = request.data.get("usuario")
    try:
        usuario_instance = Usuario.objects.get(pk=usuario_id)
    except Usuario.DoesNotExist:
        return Response({'detail': 'Usuario no encontrado.'}, status=status.HTTP_400_BAD_REQUEST)

    job.usuario = usuario_instance
    job.save()

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

    # Asociar el job con el usuario
    usuario_id = request.data.get("usuario")
    try:
        usuario_instance = Usuario.objects.get(pk=usuario_id)
    except Usuario.DoesNotExist:
        return Response({'detail': 'Usuario no encontrado.'}, status=status.HTTP_400_BAD_REQUEST)

    job.usuario = usuario_instance
    job.save()

    # Leer el contenido del JSON para procesar
    json_file.seek(0)
    try:
        det = json.load(json_file)
    except Exception as e:
        return Response({'detail': f'Error al leer el JSON: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

    # 6 y 7) Generar GLB, guardar y metadatos
    process_and_save_glb(job, det)

    return Response(Plan3DJobSerializer(job).data, status=status.HTTP_201_CREATED)

@api_view(['POST'])
def generate_dynamic_glb(request):
    """
    Endpoint que recibe el JSON de detecciones y colores dinámicos desde el frontend
    y devuelve el modelo GLB generado sin almacenar texturas en el backend.
    """
    try:
        det_json = request.data.get("det_json")
        colors = request.data.get("colors")
        usuario_id = request.data.get("usuario")

        # Convertir cadenas JSON si vienen como texto
        if isinstance(det_json, str):
            det_json = json.loads(det_json)
        if isinstance(colors, str):
            colors = json.loads(colors)

        # Crear un nuevo job temporal (sin archivo)
        job = Plan3DJob.objects.create(usuario_id=usuario_id)

        # Generar el GLB con colores personalizados
        process_and_save_glb(job, det_json, colors=colors)

        return Response(
            {
                "message": "Modelo GLB generado exitosamente con colores personalizados.",
                "job_id": job.id,
                "glb_path": job.glb_model.url if job.glb_model else None
            },
            status=status.HTTP_200_OK
        )
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



#obtener la lista de modelos generados por el usuiario require token xd
@api_view(['GET'])
@parser_classes([MultiPartParser, FormParser])
@permission_classes([IsAuthenticated])
def get_lista_modelos(request, format=None):
    jobs = Plan3DJob.objects.filter(usuario=request.user)
    ser = Plan3DJobSerializer(jobs, many=True)
    return Response(ser.data, status=status.HTTP_200_OK)


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def reemplazar_glb(request):
    """
    Reemplaza un archivo GLB existente basado en el nombre del archivo recibido.
    Espera:
      - file_glb: archivo .glb (por ejemplo "job_2.glb")
      - usuario: id del usuario que realiza la acción
    """
    new_glb = request.FILES.get('file_glb')
    usuario_id = request.data.get('usuario')

    # 🔹 Validar usuario
    try:
        usuario = Usuario.objects.get(id=usuario_id)
    except Usuario.DoesNotExist:
        return Response({"detail": "Usuario no encontrado"}, status=status.HTTP_404_NOT_FOUND)

    if not new_glb:
        return Response({"detail": "No se envió archivo .glb"}, status=status.HTTP_400_BAD_REQUEST)

    import re, time
    match = re.search(r'job_(\d+)\.glb$', new_glb.name)
    if not match:
        return Response({"detail": "Nombre de archivo no válido (debe ser job_<id>.glb)"}, status=status.HTTP_400_BAD_REQUEST)

    job_id = int(match.group(1))

    try:
        job = Plan3DJob.objects.get(id=job_id)
    except Plan3DJob.DoesNotExist:
        return Response({"detail": f"No existe Plan3DJob con id {job_id}"}, status=status.HTTP_404_NOT_FOUND)

    # 🔸 Reemplazar archivo GLB existente con nombre único (para evitar cache)
    if job.glb_model:
        job.glb_model.delete(save=False)

    timestamp = int(time.time())
    new_name = f"job_{job.id}_{timestamp}.glb"
    job.glb_model.save(new_name, new_glb, save=False)

    job.usuario = usuario
    job.save(update_fields=['glb_model', 'usuario'])

    # ✅ Devolver modelo completo actualizado
    serializer = Plan3DJobSerializer(job)
    return Response(serializer.data, status=status.HTTP_200_OK)
