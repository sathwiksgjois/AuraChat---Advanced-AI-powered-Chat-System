import json
import asyncio
import time
import traceback
import re

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from django.contrib.auth.models import AnonymousUser

from .models import ChatRoom, MessageReadStatus, Message
from .serializers import SendMessageSerializer, RoomMessageSerializer
from apps.ai.services import GroqService
from django.contrib.auth import get_user_model

User = get_user_model()
class RateLimiter:
    def __init__(self, max_calls, period):
        self.max_calls = max_calls
        self.period = period
        self.calls = []
        self.lock = asyncio.Lock()

    async def acquire(self):
        async with self.lock:
            now = time.time()
            self.calls = [t for t in self.calls if now - t < self.period]
            if len(self.calls) >= self.max_calls:
                sleep_time = self.period - (now - self.calls[0])
                print(f"⏳ Rate limit reached, waiting {sleep_time:.2f}s")
                await asyncio.sleep(sleep_time)
            self.calls.append(now)


class RateLimiter:
    def __init__(self, max_calls, period):
        self.max_calls = max_calls
        self.period = period
        self.calls = []
        self.lock = asyncio.Lock()

    async def acquire(self):
        async with self.lock:
            now = time.time()
            self.calls = [t for t in self.calls if now - t < self.period]
            if len(self.calls) >= self.max_calls:
                sleep_time = self.period - (now - self.calls[0])
                print(f"⏳ Rate limit reached, waiting {sleep_time:.2f}s")
                await asyncio.sleep(sleep_time)
            self.calls.append(now)

def extract_mentions(text):
    return re.findall(r'@(\w+)', text)

class ChatConsumer(AsyncWebsocketConsumer):
    ai_rate_limiter = RateLimiter(max_calls=14, period=60)

    async def connect(self):
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        self.room_group_name = f"chat_{self.room_id}"
        self.user = self.scope.get("user")

        if self.user is None or isinstance(self.user, AnonymousUser):
            print(f"❌ User not authenticated for room {self.room_id}")
            await self.close()
            return

        if not await self.is_participant():
            print(f"❌ User {self.user.id} not a participant of room {self.room_id}")
            await self.close()
            return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        print(f"✅ User {self.user.id} ({self.user.username}) JOINED room group {self.room_group_name}")
        await self.accept()
        print(f"✅ WebSocket accepted for user {self.user.id} in room {self.room_id}")

    async def disconnect(self, close_code):
        user_id = self.user.id if self.user else "Unknown"
        print(f"❌ User {user_id} LEFT room group {self.room_group_name} (close_code: {close_code})")
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            msg_type = data.get("type")
            print(f"📥 Received from user {self.user.id}: {msg_type}")

            if msg_type == "chat_message":
                await self.handle_chat_message(data)
            elif msg_type == "read_receipt":
                await self.handle_read_receipt(data)
            elif msg_type == "typing":
                await self.handle_typing(data)
            elif msg_type == "typing_suggestion":
                await self.handle_typing_suggestion(data)
            elif msg_type == "request_summary":
                await self.handle_request_summary(data)
            elif msg_type == "edit_message":
                await self.handle_edit_message(data)
            elif msg_type == "delete_message":
                await self.handle_delete_message(data)
            elif msg_type == "add_reaction":
                await self.handle_add_reaction(data)
            else:
                print(f"⚠️ Unknown message type: {msg_type}")
        except json.JSONDecodeError:
            print(f"❌ Invalid JSON received: {text_data}")
        except Exception as e:
            print(f"❌ Unhandled error in receive: {e}")
            traceback.print_exc()

    async def handle_chat_message(self, data):
        try:
            message_text = data["message"]
            temp_id = data.get("temp_id")
            target_lang = data.get("target_lang")
            reply_to_id = data.get("reply_to_id")
            message_type = data.get("message_type", "text")
            duration = data.get("duration")
            sticker_id = data.get("sticker_id")
            gif_url = data.get("gif_url")

            # Prepare extra data for serializer
            extra = {
                'reply_to_id': reply_to_id,
                'message_type': message_type,
                'duration': duration,
                'sticker_id': sticker_id,
                'gif_url': gif_url,
            }
            # Remove None values
            extra = {k: v for k, v in extra.items() if v is not None}

            message = await self.create_message(message_text, extra)
            serialized = await self.serialize_message(message)

            await self.channel_layer.group_send(
                self.room_group_name,
                {"type": "chat_message", "message": serialized, "temp_id": temp_id}
            )
            print(f"📤 Broadcast chat_message to room {self.room_group_name}")

            participant_ids = await self.get_participant_ids()
            for user_id in participant_ids:
                if user_id != self.user.id:
                    await self.channel_layer.group_send(
                        f"user_{user_id}",
                        {
                            "type": "new_message_notification",
                            "message": serialized,
                            "room_id": self.room_id,
                            "sender_id": self.user.id
                        }
                    )
            print(f"📤 Sent new_message_notification to users: {[uid for uid in participant_ids if uid != self.user.id]}")

            other_user_ids = [uid for uid in participant_ids if uid != self.user.id]
            if other_user_ids:
                asyncio.create_task(self.run_ai_analysis(serialized, other_user_ids[0], target_lang))

            # Handle mentions
            mentions = extract_mentions(message_text)
            if mentions:
                users = await self.get_users_by_usernames(mentions)
                for user in users:
                    if user.id != self.user.id and user.id in participant_ids:
                        await self.channel_layer.group_send(
                            f"user_{user.id}",
                            {
                                "type": "mention_notification",
                                "room_id": self.room_id,
                                "message_id": message.id,
                                "mentioned_by": self.user.username,
                            }
                        )
        except Exception as e:
            print(f"❌ Error in handle_chat_message: {e}")
            traceback.print_exc()

    async def chat_message(self, event):
        try:
            await self.send(text_data=json.dumps({
                "type": "chat_message",
                "message": event["message"],
                "temp_id": event.get("temp_id")
            }))
            print(f"📤 Delivered chat_message to client {self.user.id}")

            if self.user.id != event["message"]["sender"]["id"]:
                await self.mark_message_delivered(event["message"]["id"])
                await self.channel_layer.group_send(
                    f"user_{event['message']['sender']['id']}",
                    {
                        "type": "delivered_receipt",
                        "message_id": event["message"]["id"],
                        "delivered_to": self.user.username
                    }
                )
                print(f"📤 Sent delivered_receipt for msg {event['message']['id']} to user {event['message']['sender']['id']}")
        except Exception as e:
            print(f"❌ Error in chat_message: {e}")

    async def handle_read_receipt(self, data):
        try:
            message_id = data["message_id"]
            await self.mark_message_as_read(message_id)
            await self.channel_layer.group_send(
                self.room_group_name,
                {"type": "read_receipt", "message_id": message_id, "reader": self.user.username}
            )
            print(f"📤 Broadcast read_receipt for msg {message_id} to room {self.room_group_name}")
        except Exception as e:
            print(f"❌ Error in handle_read_receipt: {e}")

    async def read_receipt(self, event):
        try:
            await self.send(text_data=json.dumps(event))
        except Exception as e:
            print(f"❌ Error in read_receipt: {e}")

    async def handle_typing(self, data):
        try:
            is_typing = data.get("is_typing", False)
            print(f"✏️ User {self.user.id} typing in room {self.room_id}: {is_typing}")
            await self.channel_layer.group_send(
                self.room_group_name,
                {"type": "typing_indicator", "user": self.user.username, "room_id": self.room_id, "is_typing": is_typing}
            )
            print(f"📤 Broadcast typing_indicator to room {self.room_group_name}")
        except Exception as e:
            print(f"❌ Error in handle_typing: {e}")

    async def typing_indicator(self, event):
        try:
            await self.send(text_data=json.dumps(event))
        except Exception as e:
            print(f"❌ Error in typing_indicator: {e}")

    async def handle_typing_suggestion(self, data):
        try:
            partial = data.get("partial", "")
            target_lang = data.get("target_lang")
            if len(partial) < 3:
                return
            recent_msgs = await self.get_recent_messages(self.room_id, limit=5)
            recent_msgs = [msg for msg in recent_msgs if msg and isinstance(msg, str)]
            context = "\n".join(recent_msgs) if recent_msgs else ""
            ai = GroqService()
            user_lang = target_lang if target_lang else await self.get_user_language(self.user.id)
            continuation = await asyncio.to_thread(ai.generate_continuation, partial, context, user_lang)
            if continuation:
                await self.send(text_data=json.dumps({"type": "ghost_suggestion", "continuation": continuation}))
        except Exception as e:
            print(f"❌ Error in handle_typing_suggestion: {e}")

    async def handle_request_summary(self, data):
        try:
            recent_msgs = await self.get_recent_messages(self.room_id, limit=40)
            recent_msgs = [msg for msg in recent_msgs if msg and isinstance(msg, str)]
            if not recent_msgs:
                await self.send(text_data=json.dumps({"type": "chat_summary", "summary": "Not enough messages to summarize."}))
                return
            ai = GroqService()
            user_lang = await self.get_user_language(self.user.id)
            summary = await asyncio.to_thread(ai.summarize_conversation, recent_msgs, user_lang)
            await self.channel_layer.group_send(
                f"user_{self.user.id}",
                {"type": "chat_summary", "room_id": self.room_id, "summary": summary}
            )
        except Exception as e:
            print(f"❌ Error in handle_request_summary: {e}")

    async def handle_edit_message(self, data):
        try:
            await self.channel_layer.group_send(
                self.room_group_name,
                {"type": "message_edited", "message_id": data["message_id"], "new_content": data["new_content"], "edited": True}
            )
        except Exception as e:
            print(f"❌ Error in handle_edit_message: {e}")

    async def handle_delete_message(self, data):
        try:
            await self.channel_layer.group_send(
                self.room_group_name,
                {"type": "message_deleted", "message_id": data["message_id"]}
            )
        except Exception as e:
            print(f"❌ Error in handle_delete_message: {e}")

    async def message_edited(self, event):
        try:
            await self.send(text_data=json.dumps({"type": "message_edited", "message_id": event["message_id"], "new_content": event["new_content"], "edited": event["edited"]}))
        except Exception as e:
            print(f"❌ Error in message_edited: {e}")

    async def message_deleted(self, event):
        try:
            await self.send(text_data=json.dumps({"type": "message_deleted", "message_id": event["message_id"]}))
        except Exception as e:
            print(f"❌ Error in message_deleted: {e}")

    async def handle_add_reaction(self, data):
        try:
            message_id = data['message_id']
            emoji = data['emoji']
            await self.toggle_reaction(message_id, emoji, self.user)
            reactions = await self.get_reactions(message_id)
            await self.channel_layer.group_send(
                self.room_group_name,
                {'type': 'reaction_update', 'message_id': message_id, 'reactions': reactions}
            )
        except Exception as e:
            print(f"❌ Error in handle_add_reaction: {e}")

    async def reaction_update(self, event):
        try:
            await self.send(text_data=json.dumps(event))
        except Exception as e:
            print(f"❌ Error in reaction_update: {e}")

    async def run_ai_analysis(self, message, target_user_id, target_lang=None):
        try:
            await self.ai_rate_limiter.acquire()
            ai = GroqService()
            recent_msgs = await self.get_recent_messages(self.room_id, limit=3)
            recent_msgs = [msg for msg in recent_msgs if msg and isinstance(msg, str)]
            if message['content'] not in recent_msgs:
                recent_msgs.append(message['content'])
                recent_msgs = recent_msgs[-3:]
            conversation = "\n".join(recent_msgs)
            lang = target_lang if target_lang else await self.get_user_language(target_user_id)
            analysis = await asyncio.to_thread(ai.analyze_conversation, conversation, lang)

            await self.channel_layer.group_send(
                f"user_{target_user_id}",
                {
                    "type": "ai_suggestions",
                    "room_id": self.room_id,
                    "message_id": message['id'],
                    "replies": analysis['replies'],
                    "suggestions": analysis['suggestions']
                }
            )
            await self.channel_layer.group_send(
                f"user_{target_user_id}",
                {"type": "ai_summary", "room_id": self.room_id, "summary": analysis['mood']}
            )
            await self.channel_layer.group_send(
                f"user_{self.user.id}",
                {"type": "ai_summary", "room_id": self.room_id, "summary": analysis['mood']}
            )
        except Exception as e:
            print(f"❌ AI task failed: {e}")
            traceback.print_exc()

    async def mention_notification(self, event):
        await self.send(text_data=json.dumps({
            "type": "mention_notification",
            "room_id": event["room_id"],
            "message_id": event["message_id"],
            "mentioned_by": event["mentioned_by"]
        }))

    @database_sync_to_async
    def is_participant(self):
        return ChatRoom.objects.filter(id=self.room_id, participants__user=self.user).exists()

    @database_sync_to_async
    def create_message(self, message_text, extra=None):
        from .serializers import SendMessageSerializer
        data = {"room_id": self.room_id, "content": message_text}
        if extra:
            data.update(extra)
        serializer = SendMessageSerializer(data=data, context={"user": self.user})  # <-- fixed
        serializer.is_valid(raise_exception=True)
        return serializer.save()

    @database_sync_to_async
    def serialize_message(self, message):
        message = Message.objects.select_related("sender").get(id=message.id)
        return RoomMessageSerializer(message, context={'user': self.user}).data
    
    @database_sync_to_async
    def mark_message_as_read(self, message_id):
        MessageReadStatus.objects.filter(message_id=message_id, user=self.user, is_read=False).update(is_read=True, read_at=timezone.now())

    @database_sync_to_async
    def mark_message_delivered(self, message_id):
        MessageReadStatus.objects.filter(message_id=message_id, user=self.user, is_delivered=False).update(is_delivered=True, delivered_at=timezone.now())

    @database_sync_to_async
    def get_participant_ids(self):
        room = ChatRoom.objects.get(id=self.room_id)
        return list(room.participants.values_list("user_id", flat=True))

    @database_sync_to_async
    def get_recent_messages(self, room_id, limit=5):
        messages = Message.objects.filter(
            chat_room_id=room_id, is_deleted=False
        ).exclude(content__isnull=True).exclude(content__exact='').order_by('-created_at')[:limit]
        return [msg.content for msg in reversed(messages)]

    @database_sync_to_async
    def get_user_language(self, user_id):
        try:
            user = User.objects.get(id=user_id)
            return user.preferred_language
        except User.DoesNotExist:
            return 'en'

    @database_sync_to_async
    def toggle_reaction(self, message_id, emoji, user):
        from .models import MessageReaction, Message
        try:
            message = Message.objects.get(id=message_id)
        except Message.DoesNotExist:
            return
        reaction, created = MessageReaction.objects.get_or_create(message=message, user=user, emoji=emoji)
        if not created:
            reaction.delete()

    @database_sync_to_async
    def get_reactions(self, message_id):
        from .models import MessageReaction
        from .serializers import MessageReactionSerializer
        reactions = MessageReaction.objects.filter(message_id=message_id)
        return MessageReactionSerializer(reactions, many=True).data

    @database_sync_to_async
    def get_users_by_usernames(self, usernames):
        return list(User.objects.filter(username__in=usernames))

class GlobalConsumer(AsyncWebsocketConsumer):
    active_connections = {}

    async def connect(self):
        self.user = self.scope["user"]
        if self.user.is_anonymous:
            print("❌ GlobalConsumer: anonymous user rejected")
            await self.close()
            return
        self.user_group = f"user_{self.user.id}"
        await self.channel_layer.group_add(self.user_group, self.channel_name)
        await self.accept()
        print(f"🌍 GlobalConsumer connected: user {self.user.id} ({self.user.username})")
        is_first = await self.increment_connection()
        if is_first:
            await self.broadcast_presence(True)
        for uid, count in self.active_connections.items():
            if uid != self.user.id and count > 0:
                await self.channel_layer.group_send(
                    self.user_group,
                    {"type": "presence_update", "user_id": uid, "is_online": True}
                )
        await self.broadcast_delivered()

    async def disconnect(self, close_code):
        print(f"🌍 GlobalConsumer disconnected: user {self.user.id}")
        await self.channel_layer.group_discard(self.user_group, self.channel_name)
        is_last = await self.decrement_connection()
        if is_last:
            await self.update_last_seen()
            await self.broadcast_presence(False)

    async def new_message_notification(self, event):
        await self.send(text_data=json.dumps({
            "type": "new_message_notification", "message": event["message"], "room_id": event["room_id"]
        }))
        await self.channel_layer.group_send(
            f"user_{event['sender_id']}",
            {"type": "delivered_receipt", "message_id": event["message"]["id"], "delivered_to": self.user.username}
        )

    async def delivered_receipt(self, event):
        await self.send(text_data=json.dumps(event))

    async def broadcast_delivered(self):
        pending = await self.get_pending_messages()
        for msg_id, sender_id in pending:
            await self.mark_delivered(msg_id)
            await self.channel_layer.group_send(
                f"user_{sender_id}",
                {"type": "delivered_receipt", "message_id": msg_id, "delivered_to": self.user.username}
            )

    async def presence_update(self, event):
        await self.send(text_data=json.dumps(event))

    async def broadcast_presence(self, is_online):
        related_users = await self.get_related_user_ids()
        for user_id in related_users:
            await self.channel_layer.group_send(
                f"user_{user_id}",
                {"type": "presence_update", "user_id": self.user.id, "is_online": is_online}
            )

    async def ai_suggestions(self, event):
        await self.send(text_data=json.dumps(event))

    async def ai_summary(self, event):
        await self.send(text_data=json.dumps(event))

    async def chat_summary(self, event):
        await self.send(text_data=json.dumps(event))

    async def mention_notification(self, event):
        await self.send(text_data=json.dumps(event))

    async def increment_connection(self):
        user_id = self.user.id
        count = self.active_connections.get(user_id, 0) + 1
        self.active_connections[user_id] = count
        return count == 1

    async def decrement_connection(self):
        user_id = self.user.id
        count = self.active_connections.get(user_id, 1) - 1
        if count <= 0:
            self.active_connections.pop(user_id, None)
            return True
        self.active_connections[user_id] = count
        return False

    @database_sync_to_async
    def update_last_seen(self):
        self.user.last_seen = timezone.now()
        self.user.save(update_fields=["last_seen"])

    @database_sync_to_async
    def get_related_user_ids(self):
        rooms = ChatRoom.objects.filter(participants__user=self.user)
        user_ids = set()
        for room in rooms:
            for participant in room.participants.all():
                if participant.user_id != self.user.id:
                    user_ids.add(participant.user_id)
        return list(user_ids)

    @database_sync_to_async
    def get_pending_messages(self):
        pending = MessageReadStatus.objects.filter(user=self.user, is_delivered=False).select_related("message")
        return [(status.message_id, status.message.sender_id) for status in pending]

    @database_sync_to_async
    def mark_delivered(self, message_id):
        MessageReadStatus.objects.filter(message_id=message_id, user=self.user, is_delivered=False).update(is_delivered=True, delivered_at=timezone.now())
        
class GlobalConsumer(AsyncWebsocketConsumer):
    active_connections = {}

    async def connect(self):
        self.user = self.scope["user"]
        if self.user.is_anonymous:
            print("❌ GlobalConsumer: anonymous user rejected")
            await self.close()
            return

        self.user_group = f"user_{self.user.id}"
        await self.channel_layer.group_add(self.user_group, self.channel_name)
        await self.accept()
        print(f"🌍 GlobalConsumer connected: user {self.user.id} ({self.user.username})")

        is_first = await self.increment_connection()
        if is_first:
            await self.broadcast_presence(True)

        for uid, count in self.active_connections.items():
            if uid != self.user.id and count > 0:
                await self.channel_layer.group_send(
                    self.user_group,
                    {"type": "presence_update", "user_id": uid, "is_online": True}
                )
                print(f"🌍 Sent presence_update for user {uid} to new user {self.user.id}")

        await self.broadcast_delivered()

    async def disconnect(self, close_code):
        print(f"🌍 GlobalConsumer disconnected: user {self.user.id}")
        await self.channel_layer.group_discard(self.user_group, self.channel_name)
        is_last = await self.decrement_connection()
        if is_last:
            await self.update_last_seen()
            await self.broadcast_presence(False)

    async def new_message_notification(self, event):
        await self.send(text_data=json.dumps({
            "type": "new_message_notification", "message": event["message"], "room_id": event["room_id"]
        }))
        print(f"🌍 Sent new_message_notification to user {self.user.id}")

        await self.channel_layer.group_send(
            f"user_{event['sender_id']}",
            {"type": "delivered_receipt", "message_id": event["message"]["id"], "delivered_to": self.user.username}
        )
        print(f"🌍 Sent delivered_receipt for msg {event['message']['id']} to sender {event['sender_id']}")

    async def delivered_receipt(self, event):
        await self.send(text_data=json.dumps(event))
        print(f"🌍 Forwarded delivered_receipt to user {self.user.id}")

    async def broadcast_delivered(self):
        pending = await self.get_pending_messages()
        for msg_id, sender_id in pending:
            await self.mark_delivered(msg_id)
            await self.channel_layer.group_send(
                f"user_{sender_id}",
                {"type": "delivered_receipt", "message_id": msg_id, "delivered_to": self.user.username}
            )
            print(f"🌍 Broadcast delivered receipt for message {msg_id} to user {sender_id}")

    async def presence_update(self, event):
        await self.send(text_data=json.dumps(event))

    async def broadcast_presence(self, is_online):
        related_users = await self.get_related_user_ids()
        for user_id in related_users:
            await self.channel_layer.group_send(
                f"user_{user_id}",
                {"type": "presence_update", "user_id": self.user.id, "is_online": is_online}
            )
        print(f"🌍 Broadcast presence {is_online} to {len(related_users)} users")

    async def ai_suggestions(self, event):
        await self.send(text_data=json.dumps(event))

    async def ai_summary(self, event):
        await self.send(text_data=json.dumps(event))

    async def chat_summary(self, event):
        await self.send(text_data=json.dumps(event))

    async def increment_connection(self):
        user_id = self.user.id
        count = self.active_connections.get(user_id, 0) + 1
        self.active_connections[user_id] = count
        print(f"🔢 User {user_id} connections: {count}")
        return count == 1

    async def decrement_connection(self):
        user_id = self.user.id
        count = self.active_connections.get(user_id, 1) - 1
        if count <= 0:
            self.active_connections.pop(user_id, None)
            print(f"🔢 User {user_id} connections: 0 (offline)")
            return True
        self.active_connections[user_id] = count
        print(f"🔢 User {user_id} connections: {count}")
        return False

    @database_sync_to_async
    def update_last_seen(self):
        self.user.last_seen = timezone.now()
        self.user.save(update_fields=["last_seen"])
        print(f"🕒 Updated last_seen for user {self.user.id}")

    @database_sync_to_async
    def get_related_user_ids(self):
        rooms = ChatRoom.objects.filter(participants__user=self.user)
        user_ids = set()
        for room in rooms:
            for participant in room.participants.all():
                if participant.user_id != self.user.id:
                    user_ids.add(participant.user_id)
        return list(user_ids)

    @database_sync_to_async
    def get_pending_messages(self):
        pending = MessageReadStatus.objects.filter(user=self.user, is_delivered=False).select_related("message")
        return [(status.message_id, status.message.sender_id) for status in pending]

    @database_sync_to_async
    def mark_delivered(self, message_id):
        MessageReadStatus.objects.filter(message_id=message_id, user=self.user, is_delivered=False).update(is_delivered=True, delivered_at=timezone.now())