from rest_framework import serializers
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


class CustomTokenSerializer(TokenObtainPairSerializer):

    def validate(self, attrs):
        data = super().validate(attrs)

        data["user"] = {
            "id": self.user.id,
            "email": self.user.email,
            "username": self.user.username,
            "phone_number": self.user.phone_number,
        }

        return data


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "username",
            "phone_number",
            "password",
        )

    def create(self, validated_data):
        user = User.objects.create_user(
            email=validated_data["email"],
            username=validated_data["username"],
            phone_number=validated_data["phone_number"],
            password=validated_data["password"],
        )
        return user

    def to_representation(self, instance):
        refresh = RefreshToken.for_user(instance)

        return {
            "user": {
                "id": instance.id,
                "email": instance.email,
                "username": instance.username,
                "phone_number": instance.phone_number,
            },
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }



class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'avatar', 'email', 'full_name', 'bio', 'phone_number', 'last_seen']

class LanguageSerializer(serializers.Serializer):
    language = serializers.ChoiceField(choices=User.LANGUAGE_CHOICES)

class AvatarSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['avatar', 'bio', 'full_name', 'email', 'phone_number']

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'full_name', 'avatar', 'bio', 'phone_number', 'preferred_language', 'date_joined']
        read_only_fields = ['id', 'username', 'date_joined']