"""Modelos para el módulo presupuesto."""
from django.db import models
from django.utils import timezone


class CategoriaMaterial(models.Model):
    """Categoría para clasificar materiales de construcción."""

    nombre = models.CharField(max_length=100, unique=True)
    descripcion = models.TextField(blank=True, null=True)

    def __str__(self):
        """Representación en string del modelo."""
        return self.nombre


class Material(models.Model):
    """Material de construcción con precio unitario."""

    categoria = models.ForeignKey(
        CategoriaMaterial,
        on_delete=models.CASCADE,
        related_name="materiales",
        null=True,
        blank=True
    )
    nombre = models.CharField(max_length=100)
    unidad = models.CharField(max_length=20, default="m3")
    precio_unitario = models.DecimalField(max_digits=12, decimal_places=2)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    def __str__(self):
        """Representación en string del modelo."""
        return f"{self.nombre} ({self.categoria.nombre})"

