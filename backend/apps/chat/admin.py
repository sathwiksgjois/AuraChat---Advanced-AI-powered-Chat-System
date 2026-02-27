from django.contrib import admin
from .models import (
    ChatRoom, ChatParticipant, Message, MessageReadStatus,
    MessageReaction, StickerPack, Sticker
)

@admin.register(ChatRoom)
class ChatRoomAdmin(admin.ModelAdmin):
    list_display = ('id', 'room_type', 'name', 'creator', 'created_at', 'updated_at')
    list_filter = ('room_type',)
    search_fields = ('name',)
    raw_id_fields = ('creator',)

@admin.register(ChatParticipant)
class ChatParticipantAdmin(admin.ModelAdmin):
    list_display = ('id', 'chat_room', 'user', 'joined_at')
    list_filter = ('chat_room',)
    search_fields = ('user__username',)
    raw_id_fields = ('chat_room', 'user')

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'chat_room', 'sender', 'message_type', 'created_at', 'is_deleted')
    list_filter = ('message_type', 'is_deleted', 'edited', 'forwarded')
    search_fields = ('content',)
    raw_id_fields = ('chat_room', 'sender', 'reply_to', 'forwarded_from')

@admin.register(MessageReadStatus)
class MessageReadStatusAdmin(admin.ModelAdmin):
    list_display = ('id', 'message', 'user', 'is_read', 'is_delivered')
    list_filter = ('is_read', 'is_delivered')
    raw_id_fields = ('message', 'user')

@admin.register(MessageReaction)
class MessageReactionAdmin(admin.ModelAdmin):
    list_display = ('id', 'message', 'user', 'emoji', 'created_at')
    search_fields = ('emoji',)
    raw_id_fields = ('message', 'user')

# 👇 Sticker management – this is what you need to add stickers
@admin.register(StickerPack)
class StickerPackAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'author')
    search_fields = ('name',)

@admin.register(Sticker)
class StickerAdmin(admin.ModelAdmin):
    list_display = ('id', 'pack', 'emoji', 'image')
    list_filter = ('pack',)
    search_fields = ('emoji',)