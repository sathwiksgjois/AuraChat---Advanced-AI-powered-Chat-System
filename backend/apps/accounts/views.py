from rest_framework import generics, permissions
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import LanguageSerializer
from .models import User
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from .serializers import (
    RegisterSerializer,
    CustomTokenSerializer,
    UserSerializer,
    AvatarSerializer,
    UserProfileSerializer
)


class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenSerializer

class TokenRefreshView(TokenObtainPairView):
    serializer_class = CustomTokenSerializer

class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

class UpdateLanguageView(generics.UpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = LanguageSerializer

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        language = request.data.get('language')
        if language not in dict(User.LANGUAGE_CHOICES):
            return Response({'error': 'Invalid language'}, status=400)
        user.preferred_language = language
        user.save()
        return Response({'preferred_language': language})
    
class UpdateAvatarView(generics.UpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AvatarSerializer
    parser_classes = [MultiPartParser]

    def get_object(self):
        return self.request.user
    
class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self):
        return self.request.user