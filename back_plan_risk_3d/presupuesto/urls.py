from django.urls import path
from django.http import JsonResponse
from . import views
def test_view(request):
    return JsonResponse({"message": "Presupuesto API funcionando correctamente"})

urlpatterns = [
    path('', test_view),
    path('calcular/', views.calcular_presupuesto, name='calcular_presupuesto'),
    path('materiales/cargar/', views.cargar_materiales, name='cargar_materiales'),

]
