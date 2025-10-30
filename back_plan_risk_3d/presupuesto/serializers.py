from rest_framework import serializers
from .models import Material, CategoriaMaterial

class CategoriaMaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoriaMaterial
        fields = '__all__'

from rest_framework import serializers
from .models import CategoriaMaterial, Material

class MaterialSerializer(serializers.ModelSerializer):
    categoria = serializers.StringRelatedField()

    class Meta:
        model = Material
        fields = ['id', 'nombre', 'unidad', 'precio_unitario', 'categoria']
