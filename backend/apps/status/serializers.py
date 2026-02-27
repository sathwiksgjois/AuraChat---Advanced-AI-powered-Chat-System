from rest_framework import serializers
from .models import Status

class StatusSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    user_avatar = serializers.ImageField(source='user.avatar', read_only=True)
    viewers_count = serializers.SerializerMethodField()
    has_viewed = serializers.SerializerMethodField()

    class Meta:
        model = Status
        fields = ['id', 'user', 'username', 'user_avatar', 'content', 'file', 'thumbnail', 'created_at', 'expires_at', 'viewers_count', 'has_viewed']
        read_only_fields = ['user', 'created_at', 'expires_at', 'viewers_count', 'has_viewed']

    def get_viewers_count(self, obj):
        return obj.viewers.count()

    def get_has_viewed(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return request.user in obj.viewers.all()
        return False