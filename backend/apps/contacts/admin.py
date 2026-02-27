from django.contrib import admin
from .models import Contact

@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ('id', 'owner', 'contact_user', 'nickname', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('nickname', 'owner__username', 'contact_user__username')
    raw_id_fields = ('owner', 'contact_user')