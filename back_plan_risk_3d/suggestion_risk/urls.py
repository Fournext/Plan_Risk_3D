from django.urls import path
from .views import analizar_glb

urlpatterns = [
    path('analizar/', analizar_glb, name='analizar-glb'),
]
