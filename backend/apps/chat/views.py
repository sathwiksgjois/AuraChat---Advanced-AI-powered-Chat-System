import logging
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import MultiPartParser, JSONParser
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Count, Q, OuterRef, Subquery, Prefetch
from .pagination import ChatPagination
from .models import ChatRoom, Message, MessageReadStatus, StickerPack, Sticker
from .serializers import (
    CreatePrivateChatSerializer, CreateGroupChatSerializer, ChatRoomListSerializer,
    RoomMessageSerializer, SendMessageSerializer, EditMessageSerializer,
    DeleteMessageSerializer, LanguageSerializer, ParticipantSerializer,
    StickerSerializer,StickerPackSerializer
)
from apps.ai.services import GroqService
from .models import ChatRoom, ChatParticipant
from django.contrib.auth import get_user_model
from apps.accounts.serializers import UserSerializer
import json 
import requests
from django.conf import settings
User = get_user_model()
logger = logging.getLogger(__name__)

class CreatePrivateChatView(generics.CreateAPIView):
    serializer_class = CreatePrivateChatSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        room = serializer.save()
        return Response({"room_id": room.id, "message": "Private chat ready"})

class CreateGroupChatView(generics.CreateAPIView):
    serializer_class = CreateGroupChatSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        room = serializer.save()
        # Return a simple response – avoid using the serializer's data
        return Response({
            "id": room.id,
            "name": room.name,
            "message": "Group created successfully"
        }, status=status.HTTP_201_CREATED)
    
class UserChatRoomsView(generics.ListAPIView):
    serializer_class = ChatRoomListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        latest_message = Message.objects.filter(chat_room=OuterRef("pk")).order_by("-created_at")
        return ChatRoom.objects.filter(participants__user=user).annotate(
            unread_count=Count(
                "messages__read_status",
                filter=Q(messages__read_status__user=user, messages__read_status__is_read=False)
            ),
            last_message=Subquery(latest_message.values("content")[:1]),
            last_message_time=Subquery(latest_message.values("created_at")[:1])
        ).distinct().order_by("-updated_at")

class RoomMessagesView(generics.ListAPIView):
    serializer_class = RoomMessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = ChatPagination

    def get_queryset(self):
        room_id = self.kwargs["room_id"]
        user = self.request.user
        room = get_object_or_404(ChatRoom, id=room_id)

        if not room.participants.filter(user=user).exists():
            raise PermissionDenied("You are not part of this room.")

        return (
            Message.objects.filter(chat_room=room)
            .select_related("sender")
            .prefetch_related(
                Prefetch(
                    "read_status",
                    queryset=MessageReadStatus.objects.filter(user=user),
                    to_attr="user_status",
                )
            )
            .order_by("-created_at")
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update({
            "user": self.request.user
        })
        return context
    
from rest_framework.parsers import MultiPartParser, JSONParser
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from .serializers import SendMessageSerializer, RoomMessageSerializer

class SendMessageView(generics.CreateAPIView):
    serializer_class = SendMessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, JSONParser]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = serializer.save()
        # Serialize the message with RoomMessageSerializer
        output_serializer = RoomMessageSerializer(message, context={'request': request})
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

class EditMessageView(generics.GenericAPIView):
    serializer_class = EditMessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'user': request.user})
        serializer.is_valid(raise_exception=True)
        message = serializer.validated_data['message']
        message.content = serializer.validated_data['new_content']
        message.edited = True
        message.save()
        return Response(RoomMessageSerializer(message).data, status=status.HTTP_200_OK)

class DeleteMessageView(generics.GenericAPIView):
    serializer_class = DeleteMessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'user': request.user})
        serializer.is_valid(raise_exception=True)
        message = serializer.validated_data['message']
        message.is_deleted = True
        message.content = None
        message.save()
        return Response({"id": message.id, "is_deleted": True}, status=status.HTTP_200_OK)

class ForwardMessageView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        message_id = request.data.get('message_id')
        target_room_id = request.data.get('target_room_id')
        try:
            original = Message.objects.get(id=message_id)
        except Message.DoesNotExist:
            return Response({'error': 'Message not found'}, status=404)

        target_room = get_object_or_404(ChatRoom, id=target_room_id)
        if not target_room.participants.filter(user=request.user).exists():
            return Response({'error': 'Not a participant'}, status=403)

        # Create forwarded message
        new_message = Message.objects.create(
            chat_room=target_room,
            sender=request.user,
            content=original.content,
            forwarded=True,
            forwarded_from=original
        )
        # Update room's updated_at
        target_room.updated_at = timezone.now()
        target_room.save(update_fields=['updated_at'])

        # Create read status for all participants
        for participant in target_room.participants.all():
            MessageReadStatus.objects.create(
                message=new_message,
                user=participant.user,
                is_read=(participant.user == request.user),
                is_delivered=False
            )

        # Broadcast new_message_notification via global socket
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        serialized = RoomMessageSerializer(new_message).data
        for participant in target_room.participants.all():
            async_to_sync(channel_layer.group_send)(
                f"user_{participant.user.id}",
                {
                    "type": "new_message_notification",
                    "message": serialized,
                    "room_id": target_room.id,
                    "sender_id": request.user.id
                }
            )

        return Response(RoomMessageSerializer(new_message).data, status=201)
    
class TranslateBatchView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        message_ids = request.data.get('message_ids', [])
        target_lang = request.data.get('target_lang', request.user.preferred_language)
        print(f"TranslateBatch: target_lang={target_lang}, message_ids={message_ids}")

        if target_lang == 'en':
            messages = Message.objects.filter(id__in=message_ids)
            return Response({str(msg.id): msg.content for msg in messages})

        try:
            messages = Message.objects.filter(id__in=message_ids).order_by('id')
        except Exception as e:
            logger.error(f"Error fetching messages: {e}")
            return Response({"error": "Failed to fetch messages"}, status=500)

        msg_dict = {str(msg.id): msg.content for msg in messages}
        ai = GroqService()
        translations = ai.translate_batch(msg_dict, target_lang)
        if translations:
            print(f"TranslateBatch: returning {len(translations)} translations for {target_lang}")
            return Response(translations)
        print(f"TranslateBatch: translation failed for {target_lang}")
        return Response({"error": "Translation failed"}, status=500)

# class DeleteGroupView(generics.DestroyAPIView):
#     permission_classes = [permissions.IsAuthenticated]
#     queryset = ChatRoom.objects.filter(room_type='group')

#     def destroy(self, request, *args, **kwargs):
#         room = self.get_object()
#         # Only allow creator to delete
#         if room.creator != request.user:
#             return Response(
#                 {"error": "Only the group creator can delete this group."},
#                 status=status.HTTP_403_FORBIDDEN
#             )
#         room.delete()
#         return Response(status=status.HTTP_204_NO_CONTENT)
    
class DeleteRoomView(generics.DestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    queryset = ChatRoom.objects.all()

    def destroy(self, request, *args, **kwargs):
        room = self.get_object()
        # Check permissions
        if room.room_type == 'group':
            if room.creator != request.user:
                return Response(
                    {"error": "Only the group creator can delete this group."},
                    status=status.HTTP_403_FORBIDDEN
                )
        else:  # private
            if not room.participants.filter(user=request.user).exists():
                return Response(
                    {"error": "You are not a participant of this chat."},
                    status=status.HTTP_403_FORBIDDEN
                )
        room.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class GroupMembersView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ParticipantSerializer

    def get_queryset(self):
        room_id = self.kwargs['room_id']
        room = get_object_or_404(ChatRoom, id=room_id, room_type='group')
        return ChatParticipant.objects.filter(chat_room=room).select_related('user')
    
class AddGroupMemberView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, room_id):
        room = get_object_or_404(ChatRoom, id=room_id, room_type='group')
        if room.creator != request.user:
            return Response({"error": "Only creator can add members"}, status=403)
        user_id = request.data.get('user_id')
        user = get_object_or_404(User, id=user_id)
        ChatParticipant.objects.get_or_create(chat_room=room, user=user)
        return Response({"status": "added"})

class RemoveGroupMemberView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, room_id):
        room = get_object_or_404(ChatRoom, id=room_id, room_type='group')
        if room.creator != request.user and request.user.id != request.data.get('user_id'):
            return Response({"error": "Permission denied"}, status=403)
        user_id = request.data.get('user_id')
        ChatParticipant.objects.filter(chat_room=room, user_id=user_id).delete()
        return Response({"status": "removed"})

class PromoteAdminView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, room_id):
        room = get_object_or_404(ChatRoom, id=room_id, room_type='group')
        if room.creator != request.user:
            return Response({"error": "Only creator can promote"}, status=403)
        # For simplicity, we only have one creator. If you want multiple admins, add an admin field.
        # Here we just return success (no change) as we only track creator.
        return Response({"status": "promoted"})

class ExitGroupView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, room_id):
        room = get_object_or_404(ChatRoom, id=room_id, room_type='group')
        if room.creator == request.user:
            return Response({"error": "Creator cannot exit, must delete or transfer"}, status=400)
        ChatParticipant.objects.filter(chat_room=room, user=request.user).delete()
        return Response({"status": "exited"})

class ForwardMultipleMessagesView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, JSONParser]

    def post(self, request, *args, **kwargs):
        message_id = request.data.get('message_id')
        target_room_ids = json.loads(request.data.get('target_room_ids', '[]'))
        caption = request.data.get('caption', '')
        file = request.FILES.get('file')

        original = get_object_or_404(Message, id=message_id)

        created_messages = []
        for room_id in target_room_ids:
            room = get_object_or_404(ChatRoom, id=room_id)
            if not room.participants.filter(user=request.user).exists():
                continue  # skip if not participant

            # Create forwarded message
            content = caption if caption else original.content
            new_message = Message.objects.create(
                chat_room=room,
                sender=request.user,
                content=content,
                forwarded=True,
                forwarded_from=original,
                file=file if file and room_id == target_room_ids[0] else None,  # only attach file to first? Or duplicate? Better to handle file separately.
            )
            room.updated_at = timezone.now()
            room.save(update_fields=['updated_at'])

            # Create read statuses
            for participant in room.participants.all():
                MessageReadStatus.objects.create(
                    message=new_message,
                    user=participant.user,
                    is_read=(participant.user == request.user),
                    is_delivered=False
                )
            created_messages.append(new_message)

        # Broadcast notifications for each room (optional)
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        for msg in created_messages:
            serialized = RoomMessageSerializer(msg, context={'request': request}).data
            for participant in msg.chat_room.participants.all():
                async_to_sync(channel_layer.group_send)(
                    f"user_{participant.user.id}",
                    {
                        "type": "new_message_notification",
                        "message": serialized,
                        "room_id": msg.chat_room.id,
                        "sender_id": request.user.id
                    }
                )

        return Response({'status': 'forwarded', 'count': len(created_messages)}, status=201)
    

class SearchMessagesView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = RoomMessageSerializer

    def get_queryset(self):
        room_id = self.kwargs['room_id']
        q = self.request.query_params.get('q', '')
        return Message.objects.filter(
            chat_room_id=room_id,
            content__icontains=q,
            is_deleted=False
        ).order_by('-created_at')

class PinMessageView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, room_id, message_id):
        room = generics.get_object_or_404(ChatRoom, id=room_id)
        if not room.participants.filter(user=request.user).exists():
            return Response(status=403)
        message = generics.get_object_or_404(Message, id=message_id)
        room.pinned_messages.add(message)
        return Response(status=200)

class UnpinMessageView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, room_id, message_id):
        room = generics.get_object_or_404(ChatRoom, id=room_id)
        message = generics.get_object_or_404(Message, id=message_id)
        room.pinned_messages.remove(message)
        return Response(status=200)

class GiphySearchView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        query = request.query_params.get('q', '')
        if not query:
            return Response([])
        url = f"https://api.giphy.com/v1/gifs/search?api_key={settings.GIPHY_API_KEY}&q={query}&limit=20"
        try:
            resp = requests.get(url, timeout=5)
            if resp.status_code != 200:
                # Log the error and return a proper error response
                print(f"GIPHY API error: {resp.status_code} - {resp.text}")
                return Response({'error': 'GIPHY service unavailable'}, status=502)
            data = resp.json()
            return Response(data.get('data', []))
        except Exception as e:
            print(f"GIPHY request exception: {e}")
            return Response({'error': 'GIPHY request failed'}, status=502)
class StickerPackListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    queryset = StickerPack.objects.all()
    serializer_class = StickerPackSerializer  # you'll need to create this

class StickerView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    queryset = Sticker.objects.all()
    serializer_class = StickerSerializer