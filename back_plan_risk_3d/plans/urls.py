# plans/urls.py
from django.urls import path
from .views import create_plan3d_job, create_plan_json, get_lista_modelos

urlpatterns = [
    path('plans/', create_plan3d_job, name='plans-create'),
    path('plans_json/', create_plan_json, name='plans-json-create'),
    path('lista_modelos/', get_lista_modelos, name='lista-modelos'),
]
