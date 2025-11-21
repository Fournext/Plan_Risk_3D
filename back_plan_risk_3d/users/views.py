
"""Vistas para el módulo users."""
import os
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action, api_view, parser_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from users.models import Usuario

from .auth import JWTAuthentication
from .serializers import RegistroSerializer, UsuarioSerializer


class UsuarioViewSet(viewsets.ModelViewSet):
    queryset = Usuario.objects.all()
    serializer_class = UsuarioSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        """Hashear password antes de crear usuario."""
        password = serializer.validated_data.get("password")
        if password:
            serializer.validated_data["password"] = make_password(password)
        serializer.save()

    def perform_update(self, serializer):
        """Hashear password antes de actualizar usuario."""
        password = serializer.validated_data.get("password")
        if password:
            serializer.validated_data["password"] = make_password(password)
        serializer.save()


class RegistroView(generics.CreateAPIView):
    """Vista para registro de nuevos usuarios."""

    queryset = Usuario.objects.all()
    serializer_class = RegistroSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        """Crear nuevo usuario."""
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            usuario = serializer.save()
            return Response(
                UsuarioSerializer(usuario).data,
                status=status.HTTP_201_CREATED
            )
        print("❌ ERRORES DE SERIALIZER:", serializer.errors)
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


class LoginView(APIView):
    """Vista para inicio de sesión con JWT."""

    permission_classes = [AllowAny]

    def post(self, request):
        """Autenticar usuario y generar tokens JWT."""
        email = request.data.get("email")
        password = request.data.get("password")

        try:
            usuario = Usuario.objects.get(email=email)
        except Usuario.DoesNotExist:
            return Response(
                {"error": "Credenciales inválidas"},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not check_password(password, usuario.password):
            return Response(
                {"error": "Credenciales inválidas"},
                status=status.HTTP_401_UNAUTHORIZED
            )

        tokens = generar_tokens(usuario)

        return Response({
            "access": tokens["access"],
            "refresh": tokens["refresh"],
            "usuario": UsuarioSerializer(usuario).data
        })


class LogoutView(APIView):
    """Vista para cerrar sesión."""

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Cerrar sesión del usuario."""
        return Response(
            {"message": "Sesión cerrada, borra tu token localmente"},
            status=205
        )


def generar_tokens(usuario):
    """
    Generar tokens JWT para un usuario.

    Args:
        usuario: Instancia de Usuario

    Returns:
        Dict con tokens refresh y access
    """
    refresh = RefreshToken()
    refresh['usuario_id'] = usuario.id
    refresh['rol'] = usuario.rol
    access = refresh.access_token
    access.set_exp(lifetime=timedelta(hours=24))
    return {
        "refresh": str(refresh),
        "access": str(access)
    }


@api_view(['PUT'])
def update_usuario(request, pk):
    """
    Actualizar usuario existente.

    Args:
        request: Request con datos a actualizar
        pk: ID del usuario

    Returns:
        Response con usuario actualizado o error
    """
    try:
        usuario = Usuario.objects.get(pk=pk)
    except Usuario.DoesNotExist:
        return Response(
            {"error": "Usuario no encontrado"},
            status=status.HTTP_404_NOT_FOUND
        )

    serializer = UsuarioSerializer(
        usuario,
        data=request.data,
        partial=True
    )
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

