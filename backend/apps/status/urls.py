from django.urls import path
from .views import StatusListCreateView, StatusDetailView, StatusMarkViewedView, StatusViewersView

urlpatterns = [
    path('', StatusListCreateView.as_view()),
    path('<int:pk>/', StatusDetailView.as_view()),
    path('<int:pk>/view/', StatusMarkViewedView.as_view()),
    path('status/<int:pk>/viewers/', StatusViewersView.as_view()),
]