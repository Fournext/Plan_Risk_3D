# plans/urls.py
from django.urls import path
from .views import create_plan3d_job, create_plan_json

urlpatterns = [
    path('plans/', create_plan3d_job, name='plans-create'),
    path('plans_json/', create_plan_json, name='plans-json-create'),
]
