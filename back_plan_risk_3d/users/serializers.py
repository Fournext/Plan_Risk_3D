"""Serializadores para el módulo users."""
from django.contrib.auth.hashers import make_password
from rest_framework import serializers

from users.models import Usuario


class UsuarioSerializer(serializers.ModelSerializer):
    """Serializador completo para el modelo Usuario."""

    class Meta:
        model = Usuario
        fields = '__all__'


class RegistroSerializer(serializers.ModelSerializer):
    """Serializador para registro de nuevos usuarios."""

    class Meta:
        model = Usuario
        fields = [
            'id', 'nombre', 'email', 'password', 'rol',
            'telefono', 'fecha_registro', 'fecha_expiracion_plan', 'url'
        ]
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        """Crear usuario con password hasheado."""
        print("📥 Datos recibidos en el serializer:", validated_data)
        validated_data['password'] = make_password(
            validated_data['password']
        )
        return super().create(validated_data)

