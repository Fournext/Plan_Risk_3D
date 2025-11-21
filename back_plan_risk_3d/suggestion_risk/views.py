from django.shortcuts import render
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .services_gemini import analizar_modelo_glb


@api_view(['POST'])
def analizar_glb(request):
    """
    Analizar archivos .glb con Gemini AI.

    Recibe un archivo .glb y retorna análisis de daños estructurales
    y sugerencias de materiales.

    Returns:
        Response con análisis o mensaje de error
    """
    if 'archivo' not in request.FILES:
        error_msg = (
            'No se ha enviado ningún archivo. '
            'Por favor envía un archivo con la clave "archivo"'
        )
        return Response(
            {'error': error_msg},
            status=status.HTTP_400_BAD_REQUEST
        )

    archivo_glb = request.FILES['archivo']

    # Validar que sea un archivo .glb
    if not archivo_glb.name.endswith('.glb'):
        return Response(
            {'error': 'El archivo debe ser de tipo .glb'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Llamar al servicio de Gemini
    resultado = analizar_modelo_glb(archivo_glb)

    if resultado.get('success'):
        return Response(resultado, status=status.HTTP_200_OK)
    else:
        return Response(
            resultado,
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

