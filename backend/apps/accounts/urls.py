from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import LoginView, RegisterView, MeView, UpdateLanguageView, UserProfileView

urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("register/", RegisterView.as_view(), name="register"),
    path("refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", MeView.as_view(), name="me"),
    path('update-language/', UpdateLanguageView.as_view(), name='update-language'),
    path('profile/', UserProfileView.as_view(), name='user-profile'),
]
