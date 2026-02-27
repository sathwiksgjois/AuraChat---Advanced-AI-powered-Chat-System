from django.db import models
from django.conf import settings
from django.contrib.auth import get_user_model

User = get_user_model()

class ChatRoom(models.Model):
    ROOM_TYPE_CHOICES = (
        ("private", "Private"),
        ("group", "Group"),
    )
    room_type = models.CharField(max_length=10, choices=ROOM_TYPE_CHOICES)
    name = models.CharField(max_length=255, blank=True, null=True)
    avatar = models.ImageField(upload_to='group_avatars/', null=True, blank=True)
    creator = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_rooms')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    pinned_messages = models.ManyToManyField('Message', related_name='pinned_in_rooms', blank=True)

    def __str__(self):
        if self.room_type == "private":
            return f"Private Room {self.id}"
        return self.name or f"Group {self.id}"

class ChatParticipant(models.Model):
    chat_room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name="participants")
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("chat_room", "user")

class Message(models.Model):
    MESSAGE_TYPE_CHOICES = (
        ("text", "Text"),
        ("image", "Image"),
        ("file", "File"),
        ("voice", "Voice"),
        ("sticker", "Sticker"),
        ("gif", "GIF"),
    )
    chat_room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(User, on_delete=models.CASCADE)
    content = models.TextField(blank=True, null=True)
    message_type = models.CharField(max_length=10, choices=MESSAGE_TYPE_CHOICES, default="text")
    edited = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    forwarded = models.BooleanField(default=False)
    forwarded_from = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL)
    reply_to = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='replies')
    duration = models.IntegerField(null=True, blank=True)  # for voice messages (seconds)
    gif_url = models.URLField(blank=True)
    file = models.FileField(upload_to='chat_files/', null=True, blank=True)
    file_name = models.CharField(max_length=255, null=True, blank=True)
    file_size = models.IntegerField(null=True, blank=True)
    mime_type = models.CharField(max_length=100, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Message {self.id} in Room {self.chat_room.id}"

class MessageReadStatus(models.Model):
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name="read_status")
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    is_delivered = models.BooleanField(default=False)
    delivered_at = models.DateTimeField(null=True, blank=True)

class MessageReaction(models.Model):
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='reactions')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    emoji = models.CharField(max_length=10)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('message', 'user', 'emoji')

class StickerPack(models.Model):
    name = models.CharField(max_length=100)
    author = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)

class Sticker(models.Model):
    pack = models.ForeignKey(StickerPack, on_delete=models.CASCADE, related_name='stickers')
    image = models.ImageField(upload_to='stickers/')
    emoji = models.CharField(max_length=10, blank=True)