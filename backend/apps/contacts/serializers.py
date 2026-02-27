from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Contact

User = get_user_model()

class AddContactSerializer(serializers.ModelSerializer):
    phone_number = serializers.CharField(write_only=True)

    class Meta:
        model = Contact
        fields = ["phone_number", "nickname"]

    def validate(self, attrs):
        owner = self.context["request"].user
        phone = attrs.get("phone_number")

        try:
            contact_user = User.objects.get(phone_number=phone)
        except User.DoesNotExist:
            raise serializers.ValidationError({
                "phone_number": "User with this phone number not found."
            })

        if owner == contact_user:
            raise serializers.ValidationError({
                "phone_number": "You cannot add yourself."
            })

        if Contact.objects.filter(owner=owner, contact_user=contact_user).exists():
            raise serializers.ValidationError({
                "phone_number": "Contact already exists."
            })

        attrs["contact_user"] = contact_user
        return attrs

    def create(self, validated_data):
        owner = self.context["request"].user
        contact_user = validated_data.pop("contact_user")
        validated_data.pop("phone_number")

        return Contact.objects.create(
            owner=owner,
            contact_user=contact_user,
            **validated_data
        )

class ContactListSerializer(serializers.ModelSerializer):
    phone_number = serializers.CharField(source="contact_user.phone_number", read_only=True)
    username = serializers.CharField(source="contact_user.username", read_only=True)
    user_id = serializers.IntegerField(source="contact_user.id", read_only=True)

    class Meta:
        model = Contact
        fields = ["id", "username", "phone_number", "nickname","user_id"]
