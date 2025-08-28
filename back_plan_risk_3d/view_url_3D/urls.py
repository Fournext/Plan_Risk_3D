from django.urls import path
from .views import upload_glb

urlpatterns = [
    path('upload-glb/', upload_glb, name='upload_glb'),
]
