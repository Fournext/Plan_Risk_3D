# plans/urls.py
from django.urls import path
from .views import PlanCreateView

urlpatterns = [
    path('plans/', PlanCreateView.as_view(), name='plans-create'),
]
