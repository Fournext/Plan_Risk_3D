
import os

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from plans.models import Plan3DJob
from users.models import Usuario


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def upload_glb(request):
    """
    Subir archivo GLB y crear registro de Plan3DJob.

    Args:
        request: Request con archivo GLB y usuario_id

    Returns:
        Response con URL del archivo subido o mensaje de error
    """
    glb_file = request.FILES.get('file')
    if not glb_file:
        return Response(
            {'error': 'Archivo no enviado'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if not glb_file.name.endswith('.glb'):
        return Response(
            {'error': 'Solo se permiten archivos .glb'},
            status=status.HTTP_400_BAD_REQUEST
        )

    save_path = os.path.join(settings.MEDIA_ROOT, glb_file.name)
    with open(save_path, 'wb+') as destination:
        for chunk in glb_file.chunks():
            destination.write(chunk)

    file_url = settings.MEDIA_URL + glb_file.name

    usuario_id = request.data.get("usuario")
    try:
        usuario_instance = Usuario.objects.get(pk=usuario_id)
    except (ValueError, Usuario.DoesNotExist):
        return Response(
            {'detail': 'Usuario no encontrado.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    job = Plan3DJob.objects.create(
        glb_model=glb_file,
        usuario=usuario_instance
    )
    job.save()

    return Response({'url': file_url}, status=status.HTTP_201_CREATED)

