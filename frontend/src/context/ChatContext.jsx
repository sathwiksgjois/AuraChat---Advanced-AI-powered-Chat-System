import { createContext, useState, useEffect, useContext, useRef } from "react";
import { getUserChatRooms, getRoomMessages } from "../api/chatApi";
import { AuthContext } from "./AuthContext";
import { useParams } from "react-router-dom";
import axios from "../api/axios";

export const ChatContext = createContext();

export function ChatProvider({ children }) {
  const { user, deliveredMap, globalSocketRef } = useContext(AuthContext);
  const { roomId } = useParams();

  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typingMap, setTypingMap] = useState({});
  const [unreadMap, setUnreadMap] = useState({});
  const [isSocketReady, setIsSocketReady] = useState(false);
  const [messageSuggestions, setMessageSuggestions] = useState({});

  const socketRef = useRef(null);

  const transformMessage = (msg) => ({
    ...msg,
    sender: msg.sender && typeof msg.sender === "object" ? msg.sender : { id: msg.sender, username: msg.sender_username },
    is_delivered: deliveredMap[msg.id] || msg.is_delivered || false,
  });

  const refreshRooms = async () => {
    if (!user) return;
    setLoadingRooms(true);
    try {
      const data = await getUserChatRooms();
      setRooms(data.results);
    } catch (err) {
      console.error("Failed to fetch rooms", err);
    } finally {
      setLoadingRooms(false);
    }
  };

  const addRoom = (room) => {
    setRooms((prev) => (prev.some((r) => r.id === room.id) ? prev : [room, ...prev]));
  };

  const updateRoomLastMessage = (roomId, lastMessage, lastMessageTime) => {
    setRooms((prev) =>
      prev.map((room) =>
        room.id === roomId ? { ...room, last_message: lastMessage, last_message_time: lastMessageTime } : room
      )
    );
  };

  const updateRoomLastMessageRef = useRef(updateRoomLastMessage);
  useEffect(() => {
    updateRoomLastMessageRef.current = updateRoomLastMessage;
  }, [updateRoomLastMessage]);

  const editMessage = async (messageId, newContent) => {
    try {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, content: newContent, edited: true } : msg))
      );
      await axios.post("chat/messages/edit/", { message_id: messageId, new_content: newContent });
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "edit_message", message_id: messageId, new_content: newContent }));
      }
    } catch (err) {
      console.error("Edit failed", err);
    }
  };

  const deleteMessage = async (messageId) => {
    try {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, is_deleted: true, content: null } : msg))
      );
      await axios.post("chat/messages/delete/", { message_id: messageId });
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "delete_message", message_id: messageId }));
      }
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const forwardMessage = async (messageId, targetRoomId) => {
    try {
      const response = await axios.post('/chat/forward/', { message_id: messageId, target_room_id: targetRoomId });
      return response.data;
    } catch (err) {
      console.error('Forward failed', err);
    }
  };

  const addReaction = (messageId, emoji) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "add_reaction", message_id: messageId, emoji }));
    } else {
      console.warn("Socket not open, reaction not sent");
    }
  };

  const deleteGroup = async (roomId) => {
    try {
      await axios.delete(`chat/rooms/${roomId}/delete/`);
      refreshRooms();
    } catch (err) {
      console.error('Delete group failed', err);
    }
  };

  useEffect(() => {
    if (user) refreshRooms();
  }, [user]);

  useEffect(() => {
    if (!roomId || rooms.length === 0) return;
    const room = rooms.find((r) => r.id === parseInt(roomId));
    if (room) setSelectedRoom(room);
  }, [roomId, rooms]);

  useEffect(() => {
    if (!selectedRoom) return;
    const fetchMessages = async () => {
      setLoadingMessages(true);
      try {
        const data = await getRoomMessages(selectedRoom.id);
        const transformed = data.results.map(transformMessage);
        const sorted = transformed.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        setMessages(sorted);
      } catch (err) {
        console.error("Failed to fetch messages", err);
      } finally {
        setLoadingMessages(false);
      }
    };
    fetchMessages();
    setUnreadMap((prev) => ({ ...prev, [selectedRoom.id]: 0 }));
  }, [selectedRoom]);

  useEffect(() => {
    setMessages((prev) =>
      prev.map((msg) => ({ ...msg, is_delivered: deliveredMap[msg.id] || msg.is_delivered || false }))
    );
  }, [deliveredMap]);

  useEffect(() => {
    const socket = globalSocketRef?.current;
    if (!socket) return;

    const handleGlobalMessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "new_message_notification") {
        const { message, room_id } = data;
        const roomIdNum = parseInt(room_id, 10);
        if (message.sender?.id === user?.id) return;
        if (selectedRoom?.id !== roomIdNum) {
          setUnreadMap((prev) => ({ ...prev, [roomIdNum]: (prev[roomIdNum] || 0) + 1 }));
        }
        setRooms((prevRooms) =>
          prevRooms
            .map((room) =>
              room.id === roomIdNum
                ? { ...room, last_message: message.content, last_message_time: message.created_at }
                : room
            )
            .sort((a, b) => new Date(b.last_message_time || 0) - new Date(a.last_message_time || 0))
        );
      }
      if (data.type === "ai_suggestions") {
        setMessageSuggestions((prev) => ({ ...prev, [data.message_id]: data }));
      }
    };
    socket.addEventListener("message", handleGlobalMessage);
    return () => socket.removeEventListener("message", handleGlobalMessage);
  }, [globalSocketRef?.current, selectedRoom?.id, user?.id]);

  useEffect(() => {
    if (!selectedRoom?.id || !user?.username) return;

    const token = localStorage.getItem("access");
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/chat/${selectedRoom.id}/?token=${token}`);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log(`✅ Chat WS Connected for room ${selectedRoom.id} as user ${user.username}`);
      setIsSocketReady(true);
    };

    ws.onerror = (error) => console.error("❌ WebSocket error:", error);

    ws.onclose = (event) => {
      console.log(`❌ Chat WS Disconnected for room ${selectedRoom.id}`, event.reason, event.code);
      setIsSocketReady(false);
    };

    ws.onmessage = (event) => {
      console.log("📩 Raw WebSocket message:", event.data);
      const data = JSON.parse(event.data);

      if (data.type === "chat_message") {
        const realMessage = transformMessage(data.message);
        setMessages((prev) => {
          if (data.temp_id != null) {
            const tempIndex = prev.findIndex((m) => m.temp_id === data.temp_id);
            if (tempIndex !== -1) {
              const updated = [...prev];
              updated[tempIndex] = realMessage;
              return updated.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            }
          }
          if (!prev.some((m) => m.id === realMessage.id)) {
            return [...prev, realMessage].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          }
          return prev;
        });
        setRooms((prev) => {
          const updated = prev.map((room) =>
            room.id === selectedRoom.id
              ? { ...room, last_message: realMessage.content, last_message_time: realMessage.created_at }
              : room
          );
          return updated.sort((a, b) => new Date(b.last_message_time || 0) - new Date(a.last_message_time || 0));
        });
      }

      if (data.type === "read_receipt") {
        const msgId = parseInt(data.message_id, 10);
        setMessages((prev) => prev.map((msg) => (msg.id === msgId ? { ...msg, is_read: true } : msg)));
      }

      if (data.type === "typing_indicator" && data.user !== user.username) {
        setTypingMap((prev) => {
          const roomId = selectedRoom.id;
          const roomTyping = prev[roomId] || {};
          if (data.is_typing) {
            return { ...prev, [roomId]: { ...roomTyping, [data.user]: data.user } };
          } else {
            const updated = { ...roomTyping };
            delete updated[data.user];
            return { ...prev, [roomId]: updated };
          }
        });
      }

      if (data.type === "message_edited") {
        setMessages((prev) =>
          prev.map((msg) => (msg.id === data.message_id ? { ...msg, content: data.new_content, edited: true } : msg))
        );
      }

      if (data.type === "message_deleted") {
        setMessages((prev) =>
          prev.map((msg) => (msg.id === data.message_id ? { ...msg, is_deleted: true, content: null } : msg))
        );
      }

      if (data.type === "reaction_update") {
        setMessages((prev) =>
          prev.map((msg) => (msg.id === data.message_id ? { ...msg, reactions: data.reactions } : msg))
        );
      }
    };

    return () => ws.close();
  }, [selectedRoom?.id, user?.username]);

  return (
    <ChatContext.Provider
      value={{
        rooms,
        selectedRoom,
        setSelectedRoom,
        messages,
        setMessages,
        loadingRooms,
        loadingMessages,
        typingMap,
        unreadMap,
        messageSuggestions,
        refreshRooms,
        addRoom,
        updateRoomLastMessage,
        socketRef,
        isSocketReady,
        editMessage,
        deleteMessage,
        forwardMessage,
        addReaction,
        deleteGroup
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}