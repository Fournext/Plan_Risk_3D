from django.urls import path
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UsuarioViewSet,RegistroView, LoginView, LogoutView

router = DefaultRouter()
router.register(r'usuarios', UsuarioViewSet, basename='usuario')

urlpatterns = [
    path('auth/registro/', RegistroView.as_view(), name='registro'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('', include(router.urls)),
]
