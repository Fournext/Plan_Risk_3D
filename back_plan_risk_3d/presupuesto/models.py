from django.db import models
from django.utils import timezone

class CategoriaMaterial(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    descripcion = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.nombre
    
class Material(models.Model):
    categoria = models.ForeignKey(CategoriaMaterial, on_delete=models.CASCADE, related_name="materiales",null=True,
    blank=True)
    nombre = models.CharField(max_length=100)
    unidad = models.CharField(max_length=20, default="m3")  # m³, m², etc.
    precio_unitario = models.DecimalField(max_digits=12, decimal_places=2)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.nombre} ({self.categoria.nombre})"

