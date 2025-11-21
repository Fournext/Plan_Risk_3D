# plans/views.py
import hashlib
import io
import json
import os
import re
import tempfile
import time

from django.conf import settings
from django.core.files.base import ContentFile
from rest_framework import status
from rest_framework.decorators import (
    api_view,
    parser_classes,
    permission_classes
)
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from mrcnn import views
from plans.models import Plan3DJob
from users.models import Usuario
from .serializers import Plan3DJobSerializer


def process_and_save_glb(job, det):
    """
    Generar GLB en memoria, guardar metadatos y registrar en blockchain.

    Args:
        job: Instancia de Plan3DJob
        det: Diccionario con datos de detección

    Returns:
        job: Instancia actualizada de Plan3DJob
    """
    from .three import build_scene_mesh, export_glb
    from .onchain import register_on_chain

    # Generar el modelo 3D (GLB)
    mesh = build_scene_mesh(det, min_score=0.0, cut_openings=True)
    if mesh is not None:
        glb_buf = io.BytesIO()
        export_glb(mesh, glb_buf)
        filename = f'job_{job.id}.glb'
        job.glb_model.save(
            filename,
            ContentFile(glb_buf.getvalue()),
            save=False
        )

    # Guardar dimensiones
    job.width = det.get("Width", 0)
    job.height = det.get("Height", 0)

    # Calcular hashes SHA256
    json_bytes = json.dumps(det, ensure_ascii=False).encode('utf-8')
    sha_json = hashlib.sha256(json_bytes).hexdigest()
    sha_glb = (
        hashlib.sha256(glb_buf.getvalue()).hexdigest()
        if mesh is not None
        else ""
    )

    # Calcular hash real de la imagen
    sha_img = ""
    if job.plan_image:
        job.plan_image.seek(0)
        img_bytes = job.plan_image.read()
        sha_img = hashlib.sha256(img_bytes).hexdigest()
        job.plan_image.seek(0)

    # (Opcional) Subir a IPFS
    # TODO: Integrar ipfs_client.py para CIDs reales
    cid_img = "bafy-placeholder-img"
    cid_json = "bafy-placeholder-json"
    cid_glb = "bafy-placeholder-glb"
    cid_meta = "bafy-placeholder-meta"

    # Registrar en la blockchain Polygon Amoy
    try:
        tx_hash = register_on_chain(
            job.id,
            cid_img,
            cid_json,
            cid_glb,
            "0x" + sha_img,
            "0x" + sha_json,
            "0x" + sha_glb,
            cid_meta
        )
        if tx_hash:
            print(f"✅ Modelo registrado en blockchain. Tx: {tx_hash}")
            print(
                f"🔍 Ver en: https://amoy.polygonscan.com/tx/{tx_hash}"
            )
            job.blockchain_tx = tx_hash
    except Exception as e:
        print(f"⚠️ No se pudo registrar en blockchain: {e}")

    # Guardar job
    job.save()
    return job


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def create_plan3d_job(request):
    """
    Crear un job de Plan3D a partir de un archivo subido.

    Procesa el archivo, ejecuta inferencia, genera GLB y registra en blockchain.
    """
    # Guardar el archivo de entrada
    serializer = Plan3DJobSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )
    job = serializer.save()

    # Convertir a imagen si es necesario (PDF/DXF/DWG)
    from .converters import image_from_any
    img, err = image_from_any(job.plan_file.path)
    if img is None:
        detail_msg = f"No se pudo preparar la imagen para inferencia: {err}"
        return Response(
            {"detail": detail_msg},
            status=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
        )

    # Guardar la imagen rasterizada en memoria
    png_buf = io.BytesIO()
    img.save(png_buf, format='PNG')
    image_filename = f'job_{job.id}_raster.png'
    job.plan_image.save(
        image_filename,
        ContentFile(png_buf.getvalue()),
        save=False
    )

    # Ejecutar inferencia
    from .inference import run_inference
    det = run_inference(img)

    # Guardar JSON de detecciones en memoria
    json_bytes = json.dumps(det, ensure_ascii=False).encode('utf-8')
    json_filename = f'job_{job.id}_detections.json'
    job.detections_json.save(
        json_filename,
        ContentFile(json_bytes),
        save=False
    )

    # Asociar el job con el usuario
    usuario_id = request.data.get("usuario")
    try:
        usuario_instance = Usuario.objects.get(pk=usuario_id)
    except Usuario.DoesNotExist:
        return Response(
            {'detail': 'Usuario no encontrado.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    job.usuario = usuario_instance
    job.save()

    # Generar GLB y registrar en blockchain
    process_and_save_glb(job, det)

    return Response(
        Plan3DJobSerializer(job).data,
        status=status.HTTP_201_CREATED
    )


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def create_plan_json(request):
    """
    Crear un Plan3D a partir de un archivo JSON de detecciones.

    Espera un archivo .json en el campo 'plan_file' del request.
    """
    json_file = request.FILES.get('plan_file')
    if not json_file or not json_file.name.endswith('.json'):
        detail_msg = 'Se requiere un archivo .json en el campo "plan_file".'
        return Response(
            {'detail': detail_msg},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Crear job
    serializer = Plan3DJobSerializer(data=request.data)
    if not serializer.is_valid():
        print(serializer.errors)
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )
    job = serializer.save()

    # Guardar el archivo JSON en el campo detections_json
    json_filename = f'job_{job.id}_detections.json'
    job.detections_json.save(json_filename, json_file, save=False)

    # Asociar el job con el usuario
    usuario_id = request.data.get("usuario")
    try:
        usuario_instance = Usuario.objects.get(pk=usuario_id)
    except Usuario.DoesNotExist:
        return Response(
            {'detail': 'Usuario no encontrado.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    job.usuario = usuario_instance
    job.save()

    # Leer el contenido del JSON para procesar
    json_file.seek(0)
    try:
        det = json.load(json_file)
    except Exception as e:
        return Response(
            {'detail': f'Error al leer el JSON: {str(e)}'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Generar GLB y registrar en blockchain
    process_and_save_glb(job, det)

    return Response(
        Plan3DJobSerializer(job).data,
        status=status.HTTP_201_CREATED
    )


@api_view(['POST'])
def generate_dynamic_glb(request):
    """
    Generar modelo GLB con colores personalizados.

    Recibe JSON de detecciones y colores dinámicos desde el frontend
    y devuelve el modelo GLB generado.
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

        message = "Modelo GLB generado exitosamente con colores personalizados."
        return Response(
            {
                "message": message,
                "job_id": job.id,
                "glb_path": job.glb_model.url if job.glb_model else None
            },
            status=status.HTTP_200_OK
        )
    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )



@api_view(['GET'])
@parser_classes([MultiPartParser, FormParser])
@permission_classes([IsAuthenticated])
def get_lista_modelos(request, format=None):
    """
    Obtener la lista de modelos 3D generados por el usuario autenticado.

    Requiere autenticación con token.
    """
    jobs = Plan3DJob.objects.filter(usuario=request.user)
    serializer = Plan3DJobSerializer(jobs, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)



@api_view(['POST'])
def validar_plano(request):
    """
    Validar autenticidad de un plano contra blockchain.

    Recibe un job_id y los archivos (JSON, GLB, imagen)
    para verificar sus hashes contra los registrados en blockchain.
    """
    from .validator import validate_plan

    job_id = request.data.get("job_id")
    json_file = request.FILES.get("json_file")
    glb_file = request.FILES.get("glb_file")
    img_file = request.FILES.get("img_file")

    # Guardar temporalmente los archivos recibidos
    tmp_dir = tempfile.gettempdir()
    temp_json = os.path.join(tmp_dir, "tmp_json.json") if json_file else None
    temp_glb = os.path.join(tmp_dir, "tmp_model.glb") if glb_file else None
    temp_img = os.path.join(tmp_dir, "tmp_image.png") if img_file else None

    if json_file:
        with open(temp_json, 'wb') as f:
            f.write(json_file.read())
    if glb_file:
        with open(temp_glb, 'wb') as f:
            f.write(glb_file.read())
    if img_file:
        with open(temp_img, 'wb') as f:
            f.write(img_file.read())

    result = validate_plan(job_id, temp_json, temp_glb, temp_img)
    return Response(result)


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def reemplazar_glb(request):
    """
    Reemplazar un archivo GLB existente.

    Espera:
        - file_glb: archivo .glb (por ejemplo "job_2.glb")
        - usuario: id del usuario que realiza la acción

    Returns:
        Plan3DJob serializado con el nuevo archivo GLB
    """
    new_glb = request.FILES.get('file_glb')
    usuario_id = request.data.get('usuario')

    # Validar usuario
    try:
        usuario = Usuario.objects.get(id=usuario_id)
    except Usuario.DoesNotExist:
        return Response(
            {"detail": "Usuario no encontrado"},
            status=status.HTTP_404_NOT_FOUND
        )

    if not new_glb:
        return Response(
            {"detail": "No se envió archivo .glb"},
            status=status.HTTP_400_BAD_REQUEST
        )
    match = re.search(r'job_(\d+)\.glb$', new_glb.name)
    if not match:
        detail_msg = "Nombre de archivo no válido (debe ser job_<id>.glb)"
        return Response(
            {"detail": detail_msg},
            status=status.HTTP_400_BAD_REQUEST
        )

    job_id = int(match.group(1))

    try:
        job = Plan3DJob.objects.get(id=job_id)
    except Plan3DJob.DoesNotExist:
        return Response(
            {"detail": f"No existe Plan3DJob con id {job_id}"},
            status=status.HTTP_404_NOT_FOUND
        )

    # Reemplazar archivo GLB existente con nombre único (evitar cache)
    if job.glb_model:
        job.glb_model.delete(save=False)

    timestamp = int(time.time())
    new_name = f"job_{job.id}_{timestamp}.glb"
    job.glb_model.save(new_name, new_glb, save=False)

    job.usuario = usuario
    job.save(update_fields=['glb_model', 'usuario'])

    # Devolver modelo completo actualizado
    serializer = Plan3DJobSerializer(job)
    return Response(serializer.data, status=status.HTTP_200_OK)
