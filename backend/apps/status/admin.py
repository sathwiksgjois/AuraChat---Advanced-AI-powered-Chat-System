from django.contrib import admin
from .models import Status

@admin.register(Status)
class StatusAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'content', 'file', 'created_at', 'expires_at')
    list_filter = ('created_at', 'expires_at')
    search_fields = ('content', 'user__username')
    raw_id_fields = ('user',)
    filter_horizontal = ('viewers',)