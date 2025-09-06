# plans/serializers.py
from rest_framework import serializers
from .models import Plan3DJob

class Plan3DJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan3DJob
        fields = [
            'id', 'plan_file', 'plan_image',
            'detections_json', 'glb_model',
            'width', 'height', 'created_at',
            'usuario'
        ]
        read_only_fields = [
            'plan_image', 'detections_json', 'glb_model',
            'width', 'height', 'created_at','usuario']
