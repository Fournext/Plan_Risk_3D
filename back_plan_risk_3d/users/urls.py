from django.urls import path
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UsuarioViewSet,RegistroView, LoginView, LogoutView, update_usuario

router = DefaultRouter()
router.register(r'usuarios', UsuarioViewSet, basename='usuario')

urlpatterns = [
    path('auth/registro/', RegistroView.as_view(), name='registro'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/usuario/update/<int:pk>/', update_usuario, name='usuario-update'),
    path('', include(router.urls)),
]
