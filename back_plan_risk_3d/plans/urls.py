# plans/urls.py
from django.urls import path
from .views import PlanCreateView,PlanListView

urlpatterns = [
    path('plans/', PlanCreateView.as_view(), name='plans-create'),
    path('plans/list/', PlanListView.as_view(), name='plan-list'),
]
