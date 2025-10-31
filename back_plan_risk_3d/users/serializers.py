from rest_framework import serializers

from rest_framework import serializers

from django.contrib.auth.hashers import make_password

from users.models import Usuario


class UsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = '__all__'

class RegistroSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = ['id', 'nombre', 'email', 'password','rol','telefono','fecha_registro','fecha_expiracion_plan','url']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        print("📥 Datos recibidos en el serializer:", validated_data)
        validated_data['password'] = make_password(validated_data['password'])
        ##validated_data['rol'] = 'usuario_normal'
        return super().create(validated_data)

