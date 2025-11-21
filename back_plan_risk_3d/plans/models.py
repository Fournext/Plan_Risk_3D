"""Modelos para el módulo plans."""
from django.conf import settings
from django.db import models


class Plan3DJob(models.Model):
    """
    Modelo para trabajos de generación de planos 3D.

    Almacena archivos de entrada, detecciones JSON y modelos GLB generados.
    """

    # Archivo de entrada (cualquier formato)
    plan_file = models.FileField(upload_to='inputs/')

    # Versión rasterizada para inferencia (opcional)
    plan_image = models.ImageField(
        upload_to='inputs/rasterized/',
        blank=True,
        null=True
    )

    detections_json = models.FileField(
        upload_to='outputs/',
        blank=True,
        null=True
    )
    glb_model = models.FileField(
        upload_to='outputs/',
        blank=True,
        null=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    width = models.IntegerField(default=0)
    height = models.IntegerField(default=0)

    # Usuario propietario del trabajo
    usuario = models.ForeignKey(
        'users.Usuario',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='plan3d_jobs'
    )

    def __str__(self):
        """Representación en string del modelo."""
        return f'Plan3DJob #{self.id}'
