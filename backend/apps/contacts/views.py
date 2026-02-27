from rest_framework import generics, permissions
from .models import Contact
from .serializers import AddContactSerializer, ContactListSerializer


class AddContactView(generics.CreateAPIView):
    serializer_class = AddContactSerializer
    permission_classes = [permissions.IsAuthenticated]


class ListContactsView(generics.ListAPIView):
    serializer_class = ContactListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Contact.objects.filter(owner=self.request.user)
