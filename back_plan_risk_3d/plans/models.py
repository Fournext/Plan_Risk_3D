# plans/models.py
from django.db import models

class Plan3DJob(models.Model):
    # ahora aceptamos cualquier archivo de entrada (no solo ImageField)
    plan_file = models.FileField(upload_to='inputs/')
    # opcional: una versión rasterizada que usamos para inferencia
    plan_image = models.ImageField(upload_to='inputs/rasterized/', blank=True, null=True)

    detections_json = models.FileField(upload_to='outputs/', blank=True, null=True)
    glb_model = models.FileField(upload_to='outputs/', blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    width = models.IntegerField(default=0)
    height = models.IntegerField(default=0)

    def __str__(self):
        return f'Plan3DJob #{self.id}'
