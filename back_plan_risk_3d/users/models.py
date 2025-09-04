from django.db import models

class Usuario(models.Model):
    ROLES= (
        ('usuario_normal', 'Usuario Normal'),
        ('usuario_premium', 'Usuario Premium'),
    )

    nombre = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=255)
    rol = models.CharField(max_length=20, choices=ROLES, default='usuario_normal')
    fecha_expiracion_plan = models.DateField(null=True, blank=True)
    fecha_registro = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.nombre} - {self.rol}"
    
    @property
    def is_authenticated(self):
        return True
    
    @property
    def is_active(self):
        return True

    def get_username(self):
        return self.email