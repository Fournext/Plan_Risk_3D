
from datetime import timedelta
from django.conf import settings
import os
from rest_framework.decorators import action

from rest_framework.response import Response
from rest_framework import status, viewsets, generics, status

from users.models import Usuario

from .serializers import UsuarioSerializer, RegistroSerializer
from rest_framework.permissions import AllowAny, IsAuthenticated

from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.hashers import check_password, make_password
from rest_framework.views import APIView
from .auth import JWTAuthentication


class UsuarioViewSet(viewsets.ModelViewSet):
    queryset = Usuario.objects.all()
    serializer_class = UsuarioSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    # ---------Subir a Premium
    @action(detail=True, methods=['post'])
    def mejorar(self, request, pk=None):
        usuario = self.get_object()
        fecha_exp = request.data.get('fecha_expiracion_plan')

        usuario.rol = 'usuario_premium'
        if fecha_exp:
            usuario.fecha_expiracion_plan = fecha_exp
        usuario.save()

        return Response(UsuarioSerializer(usuario).data, status=status.HTTP_200_OK)

    # ----------Bajar a Normal
    @action(detail=True, methods=['post'])
    def degradar(self, request, pk=None):
        usuario = self.get_object()
        usuario.rol = 'usuario_normal'
        usuario.fecha_expiracion_plan = None
        usuario.save()

        return Response(UsuarioSerializer(usuario).data, status=status.HTTP_200_OK)

    def perform_create(self, serializer):
        password = serializer.validated_data.get("password")
        if password:
            serializer.validated_data["password"] = make_password(password)
        serializer.save()

    def perform_update(self, serializer):
        password = serializer.validated_data.get("password")
        if password:
            serializer.validated_data["password"] = make_password(password)
        serializer.save()


class RegistroView(generics.CreateAPIView):
    queryset = Usuario.objects.all()
    serializer_class = RegistroSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            usuario = serializer.save()
            return Response(UsuarioSerializer(usuario).data, status=status.HTTP_201_CREATED)
        print("❌ ERRORES DE SERIALIZER:", serializer.errors)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")

        try:
            usuario = Usuario.objects.get(email=email)
        except Usuario.DoesNotExist:
            return Response({"error": "Credenciales inválidas"},
                            status=status.HTTP_401_UNAUTHORIZED)

        if not check_password(password, usuario.password):
            return Response({"error": "Credenciales inválidas"},
                            status=status.HTTP_401_UNAUTHORIZED)

        tokens = generar_tokens(usuario)

        return Response({
            "access": tokens["access"],
            "refresh": tokens["refresh"],
            "usuario": UsuarioSerializer(usuario).data
        })


class LogoutView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        return Response({"message": "Sesión cerrada, borra tu token localmente"}, status=205)


def generar_tokens(usuario):
    refresh = RefreshToken()
    refresh['usuario_id'] = usuario.id
    refresh['rol'] = usuario.rol
    access = refresh.access_token
    access.set_exp(lifetime=timedelta(hours=24))
    return {
        "refresh": str(refresh),
        "access": str(access)
    }
