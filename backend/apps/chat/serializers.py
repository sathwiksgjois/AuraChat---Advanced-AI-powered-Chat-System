from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import ChatRoom, ChatParticipant, Message, MessageReadStatus, MessageReaction,Sticker, StickerPack

from apps.contacts.models import Contact
from django.utils import timezone
from apps.accounts.serializers import UserSerializer

User = get_user_model()

class CreatePrivateChatSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()

    def validate_user_id(self, value):
        request_user = self.context["request"].user
        if request_user.id == value:
            raise serializers.ValidationError("You cannot chat with yourself.")
        try:
            other_user = User.objects.get(id=value)
        except User.DoesNotExist:
            raise serializers.ValidationError("User does not exist.")
        if not Contact.objects.filter(owner=request_user, contact_user=other_user).exists():
            raise serializers.ValidationError("User is not in your contacts.")
        return other_user

    def create(self, validated_data):
        request_user = self.context["request"].user
        other_user = validated_data["user_id"]
        existing_room = ChatRoom.objects.filter(
            room_type="private",
            participants__user=request_user
        ).filter(participants__user=other_user).distinct().first()
        if existing_room:
            return existing_room
        room = ChatRoom.objects.create(room_type="private")
        ChatParticipant.objects.create(chat_room=room, user=request_user)
        ChatParticipant.objects.create(chat_room=room, user=other_user)
        return room

import json
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import ChatRoom, ChatParticipant

User = get_user_model()

class CreateGroupChatSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    user_ids = serializers.CharField()  # accept as string
    avatar = serializers.ImageField(required=False, allow_null=True)

    def validate_user_ids(self, value):
        try:
            user_ids = json.loads(value)
            if not isinstance(user_ids, list):
                raise serializers.ValidationError("user_ids must be a list")
        except json.JSONDecodeError:
            raise serializers.ValidationError("Invalid JSON for user_ids")

        request_user = self.context["request"].user
        unique_ids = set(user_ids)
        if request_user.id in unique_ids:
            raise serializers.ValidationError("Do not include yourself in user_ids.")

        users = User.objects.filter(id__in=unique_ids)
        if len(users) != len(unique_ids):
            raise serializers.ValidationError("One or more users do not exist.")

        return list(unique_ids)  # return as list

    def create(self, validated_data):
        request_user = self.context["request"].user
        user_ids = validated_data["user_ids"]  # now a list
        name = validated_data["name"]
        avatar = validated_data.get("avatar")

        room = ChatRoom.objects.create(
            room_type="group",
            name=name,
            avatar=avatar,
            creator=request_user
        )
        ChatParticipant.objects.create(chat_room=room, user=request_user)

        for user_id in user_ids:
            user = User.objects.get(id=user_id)
            ChatParticipant.objects.create(chat_room=room, user=user)

        return room
class SendMessageSerializer(serializers.Serializer):
    room_id = serializers.IntegerField(write_only=True)
    content = serializers.CharField(max_length=5000, required=False, allow_blank=True)
    file = serializers.FileField(required=False, write_only=True)
    reply_to_id = serializers.IntegerField(required=False, allow_null=True)
    message_type = serializers.CharField(required=False, default='text')
    duration = serializers.IntegerField(required=False, allow_null=True)
    sticker_id = serializers.IntegerField(required=False, allow_null=True)
    gif_url = serializers.URLField(required=False, allow_blank=True)

    def _get_user(self):
        """Unified way to get user for both HTTP and WebSocket contexts."""
        user = self.context.get("user")
        if not user:
            request = self.context.get("request")
            if request:
                user = getattr(request, 'user', None)
        if not user:
            raise serializers.ValidationError("User not found in context.")
        return user

    def validate(self, attrs):
        user = self._get_user()
        room_id = attrs["room_id"]
        try:
            room = ChatRoom.objects.get(id=room_id)
        except ChatRoom.DoesNotExist:
            raise serializers.ValidationError("Room does not exist.")
        if not room.participants.filter(user=user).exists():
            raise serializers.ValidationError("Not a participant.")

        content = attrs.get('content', '').strip()
        file = attrs.get('file')
        if not content and not file and not attrs.get('sticker_id') and not attrs.get('gif_url'):
            raise serializers.ValidationError("Either content, file, sticker, or GIF is required.")

        attrs["room"] = room
        return attrs

    def create(self, validated_data):
        user = self._get_user()
        room = validated_data["room"]
        content = validated_data.get('content', '')
        file = validated_data.get('file')
        reply_to_id = validated_data.get('reply_to_id')
        message_type = validated_data.get('message_type', 'text')
        duration = validated_data.get('duration')
        gif_url = validated_data.get('gif_url', '')
        sticker_id = validated_data.get('sticker_id')

        reply_to = None
        if reply_to_id:
            try:
                reply_to = Message.objects.get(id=reply_to_id)
            except Message.DoesNotExist:
                pass

        if sticker_id:
            try:
                sticker = Sticker.objects.get(id=sticker_id)
                content = sticker.image.url
                message_type = 'sticker'
            except Sticker.DoesNotExist:
                pass

        message = Message.objects.create(
            chat_room=room,
            sender=user,
            content=content,
            file=file,
            file_name=file.name if file else None,
            file_size=file.size if file else None,
            mime_type=file.content_type if file else None,
            message_type=message_type,
            reply_to=reply_to,
            duration=duration,
            gif_url=gif_url,
        )

        room.updated_at = timezone.now()
        room.save(update_fields=["updated_at"])

        # Sender status
        MessageReadStatus.objects.create(
            message=message, user=user, is_read=True, read_at=timezone.now(),
            is_delivered=True, delivered_at=timezone.now()
        )
        # Other participants
        other_users = room.participants.exclude(user=user)
        for participant in other_users:
            MessageReadStatus.objects.create(
                message=message, user=participant.user, is_read=False, is_delivered=False
            )

        return message
      
class ChatRoomListSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    is_online = serializers.SerializerMethodField()
    last_seen = serializers.SerializerMethodField()
    other_user_id = serializers.SerializerMethodField()
    is_group = serializers.SerializerMethodField()
    last_message = serializers.CharField(read_only=True)
    last_message_time = serializers.DateTimeField(read_only=True)
    unread_count = serializers.IntegerField(read_only=True)
    other_user_avatar = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()
    creator_id = serializers.IntegerField(source='creator.id', read_only=True)

    class Meta:
        model = ChatRoom
        fields = [
        "id", "is_group", "display_name", "last_message", "last_message_time",
        "unread_count", "is_online", "last_seen", "other_user_id", "other_user_avatar",
        "avatar", "creator_id",
    ]

    def get_is_online(self, obj):
        request_user = self.context["request"].user
        if obj.room_type == "group":
            return None
        other = obj.participants.exclude(user=request_user).first()
        return False if not other else False  # Placeholder; implement Redis later

    def get_last_seen(self, obj):
        request_user = self.context["request"].user
        if obj.room_type == "group":
            return None
        other = obj.participants.exclude(user=request_user).first()
        return other.user.last_seen if other else None

    def get_other_user_id(self, obj):
        request_user = self.context["request"].user
        if obj.room_type == "group":
            return None
        other = obj.participants.exclude(user=request_user).first()
        return other.user.id if other else None

    def get_is_group(self, obj):
        return obj.room_type == "group"

    def get_display_name(self, obj):
        request_user = self.context["request"].user
        if obj.room_type == "group":
            return obj.name
        other = obj.participants.exclude(user=request_user).first()
        if other:
            # Try to get the contact from the current user's contact list
            contact = Contact.objects.filter(owner=request_user, contact_user=other.user).first()
            if contact and contact.nickname:
                return contact.nickname
            return other.user.username
        return "Unknown"

    def get_other_user_avatar(self, obj):
        request = self.context.get("request")

        if obj.room_type == "private":
            other = obj.participants.exclude(
                user=request.user
            ).first()

            if other and other.user.avatar:
                return request.build_absolute_uri(
                    other.user.avatar.url
                )

        return None
    
    def get_avatar(self, obj):
        request = self.context.get("request")
        if obj.avatar:
            return request.build_absolute_uri(obj.avatar.url)
        return None
    
class MessageReactionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = MessageReaction
        fields = ['id', 'emoji', 'username', 'created_at']

class RoomMessageSerializer(serializers.ModelSerializer):
    sender = serializers.SerializerMethodField()
    is_read = serializers.SerializerMethodField()
    is_delivered = serializers.SerializerMethodField()
    reactions = MessageReactionSerializer(many=True, read_only=True)
    file_url = serializers.SerializerMethodField()
    reply_to = serializers.SerializerMethodField()
    pinned = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            "id", "content", "sender", "created_at", "is_delivered", "is_read",
            "is_deleted", "forwarded", "reactions", "file", "file_name",
            "file_size", "mime_type", "file_url", "message_type", "duration",
            "gif_url", "reply_to", "pinned"
        ]

    def _get_user(self):
        """Safely get user from context (supports both HTTP request and direct user)."""
        user = self.context.get("user")
        if not user:
            request = self.context.get("request")
            if request:
                user = getattr(request, 'user', None)
        return user

    def get_sender(self, obj):
        return {"id": obj.sender.id, "username": obj.sender.username}

    def get_is_read(self, obj):
        user = self._get_user()
        if not user or obj.sender != user:
            return False
        other_status = obj.read_status.exclude(user=user).first()
        return other_status.is_read if other_status else False

    def get_is_delivered(self, obj):
        user = self._get_user()
        if not user or obj.sender != user:
            return False
        other_status = obj.read_status.exclude(user=user).first()
        return other_status.is_delivered if other_status else False

    def get_file_url(self, obj):
        if not obj.file:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url

    def get_reply_to(self, obj):
        if obj.reply_to:
            return {
                'id': obj.reply_to.id,
                'content': obj.reply_to.content,
                'sender_username': obj.reply_to.sender.username,
            }
        return None

    def get_pinned(self, obj):
        return obj.chat_room.pinned_messages.filter(id=obj.id).exists()
        
class EditMessageSerializer(serializers.Serializer):
    message_id = serializers.IntegerField()
    new_content = serializers.CharField(max_length=5000)

    def validate(self, data):
        user = self.context['user']
        try:
            message = Message.objects.get(id=data['message_id'])
        except Message.DoesNotExist:
            raise serializers.ValidationError("Message not found.")
        if message.sender != user:
            raise serializers.ValidationError("Not your message.")
        data['message'] = message
        return data

class DeleteMessageSerializer(serializers.Serializer):
    message_id = serializers.IntegerField()

    def validate(self, data):
        user = self.context['user']
        try:
            message = Message.objects.get(id=data['message_id'])
        except Message.DoesNotExist:
            raise serializers.ValidationError("Message not found.")
        if message.sender != user:
            raise serializers.ValidationError("Not your message.")
        data['message'] = message
        return data

    def delete(self, validated_data):
        message = validated_data['message']
        message.is_deleted = True
        message.content = None
        message.save()
        return message

class LanguageSerializer(serializers.Serializer):
    language = serializers.ChoiceField(choices=User.LANGUAGE_CHOICES)

class ParticipantSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = ChatParticipant
        fields = ['id', 'user', 'joined_at']

class StickerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sticker
        fields = ['id', 'image', 'emoji']

class StickerPackSerializer(serializers.ModelSerializer):
    stickers = StickerSerializer(many=True, read_only=True)

    class Meta:
        model = StickerPack
        fields = ['id', 'name', 'author', 'stickers']