from rest_framework import generics, permissions, status
from rest_framework.response import Response
from django.utils import timezone
from .models import Status
from .serializers import StatusSerializer
from apps.accounts.serializers import UserSerializer

class StatusListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = StatusSerializer

    def get_queryset(self):
        # Get statuses from followed users (if any) + own, not expired
        user = self.request.user
        # For simplicity, we'll just show all statuses from all users (except expired)
        # In a real app, you might want to filter by contacts or followed users.
        return Status.objects.filter(expires_at__gt=timezone.now()).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class StatusDetailView(generics.RetrieveDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    queryset = Status.objects.all()
    serializer_class = StatusSerializer

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        # Mark as viewed when fetched (if not own)
        if request.user != instance.user:
            instance.viewers.add(request.user)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

class StatusMarkViewedView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    queryset = Status.objects.all()

    def post(self, request, pk):
        status = self.get_object()
        if request.user != status.user:
            status.viewers.add(request.user)
        return Response({'status': 'viewed'})

class StatusViewersView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    queryset = Status.objects.all()
    serializer_class = UserSerializer  

    def retrieve(self, request, *args, **kwargs):
        status = self.get_object()
        viewers = status.viewers.all()
        serializer = self.get_serializer(viewers, many=True)
        return Response(serializer.data)