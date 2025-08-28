
from django.http import JsonResponse
from django.conf import settings
import os
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status

@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def upload_glb(request):
	glb_file = request.FILES.get('file')
	if not glb_file:
		return Response({'error': 'Archivo no enviado'}, status=status.HTTP_400_BAD_REQUEST)
	if not glb_file.name.endswith('.glb'):
		return Response({'error': 'Solo se permiten archivos .glb'}, status=status.HTTP_400_BAD_REQUEST)
	save_path = os.path.join(settings.MEDIA_ROOT, glb_file.name)
	with open(save_path, 'wb+') as destination:
		for chunk in glb_file.chunks():
			destination.write(chunk)
	file_url = settings.MEDIA_URL + glb_file.name
	return Response({'url': file_url}, status=status.HTTP_201_CREATED)
