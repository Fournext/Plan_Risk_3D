# plans/urls.py
from django.urls import path
from .views import create_plan3d_job, create_plan_json, get_lista_modelos,generate_dynamic_glb, validar_plano
urlpatterns = [
    path('plans/', create_plan3d_job, name='plans-create'),
    path('plans_json/', create_plan_json, name='plans-json-create'),
    path('lista_modelos/', get_lista_modelos, name='lista-modelos'),
    path('generate_dynamic_glb/', generate_dynamic_glb, name='generate_dynamic_glb'),
    path('validar_plano/', validar_plano, name='validar-plano'),
]
