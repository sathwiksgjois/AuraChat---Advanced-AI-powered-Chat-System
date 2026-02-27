import { useContext, useEffect, useRef, useState, useMemo } from "react";
import { ChatContext } from "../../context/ChatContext";
import { AuthContext } from "../../context/AuthContext";
import { useChatActions } from "../../context/ChatActionsContext";
import { useLanguage } from "../../context/LanguageContext";
import { useNavigate } from "react-router-dom";
import axios from "../../api/axios";
import RoomDetails from "../chat/RoomDetails";
import ForwardModal from "../chat/ForwardModal";
import SearchBar from "../chat/SearchBar";
import ReplyPreview from "../chat/ReplyPreview";
import MentionSuggestions from "../chat/MentionSuggestions";
import VoiceRecorder from "../chat/VoiceRecorder";
import GifPicker from "../chat/GifPicker";
import AudioMessage from "../chat/AudioMessage";

export default function ChatWindow() {
  const navigate = useNavigate();
  const {
    selectedRoom,
    rooms,
    messages,
    setMessages,
    isSocketReady,
    socketRef,
    messageSuggestions,
    editMessage,
    deleteMessage,
    forwardMessage,
    addReaction,
    loadingMessages,
  } = useContext(ChatContext);
  const { user, onlineUsers, deliveredMap } = useContext(AuthContext);
  const { registerSetInputMessage } = useChatActions();
  const {
    messageTargetLang,
    changeMessageLanguage,
    translateBatch,
    isTranslating,
    getDisplayContent,
    setCurrentRoomId,
  } = useLanguage();
  const [typingMap, setTypingMap] = useState({});
  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const suggestionTimeoutRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [newMessage, setNewMessage] = useState("");
  const [ghostSuggestion, setGhostSuggestion] = useState("");
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState("");
  const [activeMenuMsgId, setActiveMenuMsgId] = useState(null);
  const [showEmojiPickerFor, setShowEmojiPickerFor] = useState(null);
  const [showRoomMenu, setShowRoomMenu] = useState(false);
  const [showRoomDetails, setShowRoomDetails] = useState(false);
  const [forwardModal, setForwardModal] = useState({ open: false, message: null });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const menuRef = useRef(null);
  const [groupMembers, setGroupMembers] = useState([]);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenuMsgId(null);
        setShowEmojiPickerFor(null);
        setShowRoomMenu(false);
        setShowGifPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    registerSetInputMessage(setNewMessage);
  }, [registerSetInputMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (selectedRoom?.id) setCurrentRoomId(selectedRoom.id);
  }, [selectedRoom?.id, setCurrentRoomId]);

  useEffect(() => {
    if (!selectedRoom?.id || messages.length === 0) return;
    const handler = setTimeout(() => translateBatch(messages, selectedRoom.id), 300);
    return () => clearTimeout(handler);
  }, [messageTargetLang, messages, translateBatch, selectedRoom?.id]);

  useEffect(() => {
    const ws = socketRef.current;
    if (!ws) return;

    const handleMessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("📩 WS message in ChatWindow:", data.type, data);

      switch (data.type) {
        case "ghost_suggestion":
          if (newMessage.trim().length > 0) setGhostSuggestion(data.continuation);
          break;
        case "message_edited":
          setMessages(prev => prev.map(msg =>
            msg.id === data.message_id ? { ...msg, content: data.new_content, edited: true } : msg
          ));
          break;
        case "message_deleted":
          setMessages(prev => prev.map(msg =>
            msg.id === data.message_id ? { ...msg, is_deleted: true, content: null } : msg
          ));
          break;
        case "reaction_update":
          setMessages(prev => prev.map(msg =>
            msg.id === data.message_id ? { ...msg, reactions: data.reactions } : msg
          ));
          break;
        case "mention_notification":
          alert(`You were mentioned by ${data.mentioned_by} in room ${data.room_id}`);
          break;
        default:
          break;
      }
    };
    ws.addEventListener("message", handleMessage);
    return () => ws.removeEventListener("message", handleMessage);
  }, [socketRef.current, newMessage, setMessages]);

  useEffect(() => {
    if (!selectedRoom) return;
    const roomSocket = socketRef.current;
    if (!roomSocket) return;
    messages.forEach(msg => {
      if (!msg.is_read && msg.sender?.id !== user.id && !msg.temp_id) {
        roomSocket.send(JSON.stringify({ type: "read_receipt", message_id: msg.id }));
      }
    });
  }, [messages, selectedRoom, socketRef, user.id]);

  useEffect(() => {
    if (selectedRoom?.is_group) {
      axios.get(`/chat/rooms/${selectedRoom.id}/members/`)
        .then(res => setGroupMembers(res.data))
        .catch(console.error);
    }
  }, [selectedRoom]);

  const onlineMembersCount = useMemo(() => {
    if (!selectedRoom?.is_group || !groupMembers.length) return null;
    return groupMembers.filter(m => onlineUsers.includes(m.user.id)).length;
  }, [groupMembers, onlineUsers, selectedRoom]);

  const handleSend = () => {
    if (!newMessage.trim() && !replyTo) return;
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const tempId = Date.now();
    const payload = {
      type: "chat_message",
      message: newMessage,
      temp_id: tempId,
      target_lang: messageTargetLang,
    };
    if (replyTo) payload.reply_to_id = replyTo.id;

    setMessages(prev => [...prev, {
      id: tempId,
      content: newMessage,
      sender: user,
      created_at: new Date().toISOString(),
      is_read: false,
      is_delivered: false,
      temp_id: tempId,
      reactions: [],
      reply_to: replyTo ? { id: replyTo.id, content: replyTo.content, sender_username: replyTo.sender_username } : null,
    }]);
    setGhostSuggestion("");
    setReplyTo(null);
    ws.send(JSON.stringify(payload));
    setNewMessage("");
  };

  const handleTyping = (e) => {
    const text = e.target.value;
    setNewMessage(text);
    setGhostSuggestion("");

    const words = text.split(' ');
    const lastWord = words[words.length - 1];
    if (lastWord.startsWith('@') && lastWord.length > 1) {
      const query = lastWord.slice(1);
      const filtered = groupMembers.filter(m =>
        m.user.username.toLowerCase().includes(query.toLowerCase())
      );
      setMentionSuggestions(filtered);
    } else {
      setMentionSuggestions([]);
    }

    const roomSocket = socketRef.current;
    if (!roomSocket) return;
    roomSocket.send(JSON.stringify({ type: "typing", is_typing: true }));

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "typing", is_typing: false }));
      }
    }, 2000);

    if (suggestionTimeoutRef.current) clearTimeout(suggestionTimeoutRef.current);
    if (text.length >= 3) {
      suggestionTimeoutRef.current = setTimeout(() => {
        socketRef.current?.send(JSON.stringify({
          type: "typing_suggestion",
          partial: text,
          target_lang: messageTargetLang
        }));
      }, 500);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Tab" && ghostSuggestion) {
      e.preventDefault();
      setNewMessage(newMessage + ghostSuggestion);
      setGhostSuggestion("");
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append('room_id', selectedRoom.id);
    formData.append('file', file);
    if (newMessage.trim()) formData.append('content', newMessage);
    if (replyTo) formData.append('reply_to_id', replyTo.id);

    try {
      const response = await axios.post(`chat/rooms/${selectedRoom.id}/send/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent);
        }
      });
      setMessages(prev => [...prev, { id: Date.now(), ...response.data, temp_id: Date.now(), sender: user }]);
      setNewMessage('');
      setReplyTo(null);
      e.target.value = '';
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleVoiceSend = async (blob) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('room_id', selectedRoom.id);
    formData.append('file', blob, 'voice.webm');
    formData.append('message_type', 'voice');
    if (replyTo) formData.append('reply_to_id', replyTo.id);
    try {
      const response = await axios.post(`chat/rooms/${selectedRoom.id}/send/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessages(prev => [...prev, { id: Date.now(), ...response.data, temp_id: Date.now(), sender: user }]);
      setReplyTo(null);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const toggleMessageLanguage = () => {
    changeMessageLanguage(messageTargetLang === 'en' ? 'hi' : messageTargetLang === 'hi' ? 'kn' : 'en');
  };

  const startEditing = (msg) => {
    setEditingMessageId(msg.id);
    setEditText(msg.content);
    setActiveMenuMsgId(null);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditText("");
  };

  const saveEdit = (msgId) => {
    if (editText.trim() && editText !== messages.find(m => m.id === msgId)?.content) {
      editMessage(msgId, editText);
    }
    cancelEditing();
  };

  const handleEditKeyDown = (e, msgId) => {
    if (e.key === "Enter") { e.preventDefault(); saveEdit(msgId); }
    else if (e.key === "Escape") cancelEditing();
  };

  const handleDelete = (msgId) => {
    if (window.confirm("Delete this message?")) {
      deleteMessage(msgId);
      setActiveMenuMsgId(null);
    }
  };

  const handleCopy = (content) => {
    navigator.clipboard.writeText(content);
    setActiveMenuMsgId(null);
  };

  const handleForward = (msg) => {
    setForwardModal({ open: true, message: msg });
    setActiveMenuMsgId(null);
  };

  const handleEmojiSelect = (emojiChar, msgId) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      addReaction(msgId, emojiChar);
    }
    setShowEmojiPickerFor(null);
    setActiveMenuMsgId(null);
  };

  const handleContextMenu = (e, msg) => {
    e.preventDefault();
    setActiveMenuMsgId(msg.id);
  };

  const handleDeleteRoom = async () => {
    const confirmMsg = selectedRoom.is_group ? "Delete group?" : "Delete chat?";
    if (window.confirm(confirmMsg)) {
      try {
        await axios.delete(`chat/rooms/${selectedRoom.id}/delete/`);
        navigate('/');
      } catch (err) {
        alert(err.response?.data?.error || 'Failed');
      }
    }
    setShowRoomMenu(false);
  };

  const handlePin = async (msgId, pinned) => {
    try {
      if (pinned) {
        await axios.post(`/chat/rooms/${selectedRoom.id}/unpin/${msgId}/`);
      } else {
        await axios.post(`/chat/rooms/${selectedRoom.id}/pin/${msgId}/`);
      }
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, pinned: !pinned } : m));
    } catch (err) {
      console.error(err);
    }
  };

  const ReactionDisplay = ({ reactions }) => {
    if (!reactions?.length) return null;
    const grouped = reactions.reduce((acc, r) => { acc[r.emoji] = (acc[r.emoji] || 0) + 1; return acc; }, {});
    return (
      <div className="flex flex-wrap gap-1 mt-1 animate-fadeIn">
        {Object.entries(grouped).map(([e, c]) => (
          <span
            key={e}
            className="text-xs bg-white/30 backdrop-blur-sm rounded-full px-2 py-0.5 border border-white/20 hover:bg-white/50 transition-all duration-300 cursor-default"
          >
            {e} {c > 1 ? c : ''}
          </span>
        ))}
      </div>
    );
  };

  if (!selectedRoom) {
    return (
      <div className="flex-1 h-full bg-white/30 backdrop-blur-xl rounded-3xl border border-white/20 flex items-center justify-center animate-fadeIn">
        <p className="text-gray-600 animate-pulse">Select a chat to start messaging</p>
      </div>
    );
  }

  const isOnline = !selectedRoom.is_group && onlineUsers.includes(selectedRoom.other_user_id);
  const formatTime = (ts) => ts ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

  const TickIndicator = ({ msg }) => {
    if (msg.sender?.id !== user?.id) return null;
    const d = deliveredMap[msg.id] || msg.is_delivered;
    const r = msg.is_read;
    let ticks = "✓", color = "text-purple-200";
    if (d && !r) { ticks = "✓✓"; color = "text-gray-400"; } else if (r) { ticks = "✓✓"; color = "text-blue-400"; }
    return <span className={color}>{ticks}</span>;
  };

  const forwardableRooms = rooms.filter(r => r.id !== selectedRoom.id);
  const headerAvatar = selectedRoom.is_group ? selectedRoom.avatar : selectedRoom.other_user_avatar;
  const headerName = selectedRoom.display_name;

  // Group typing indicator
  const typingUsers = selectedRoom.is_group
    ? Object.entries(typingMap[selectedRoom.id] || {})
        .filter(([username]) => username !== user?.username)
        .map(([username]) => username)
    : [];
  const typingText = typingUsers.length > 0
    ? (typingUsers.length === 1 ? `${typingUsers[0]} is typing...` : `${typingUsers.join(', ')} are typing...`)
    : null;

  return (
    <div className="flex-1 h-full bg-white/30 backdrop-blur-xl rounded-3xl border border-white/20 flex flex-col overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-white/20 flex items-center gap-3 bg-white/10 backdrop-blur-sm shrink-0">
        <div
          className="flex items-center gap-3 flex-1 cursor-pointer group"
          onClick={() => setShowRoomDetails(true)}
        >
          <div className="relative">
            <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-transparent group-hover:ring-purple-500 transition-all duration-300">
              {headerAvatar ? (
                <img src={headerAvatar} alt={headerName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                  {headerName?.charAt(0).toUpperCase() || "?"}
                </div>
              )}
            </div>
            {!selectedRoom.is_group && isOnline && (
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full animate-pulse" />
            )}
          </div>
          <div>
            <h2 className="font-semibold text-gray-800 group-hover:text-purple-600 transition-colors duration-300">
              {headerName}
            </h2>
            {selectedRoom.is_group ? (
              <p className="text-xs text-gray-500">
                {onlineMembersCount !== null ? `${onlineMembersCount} online` : "0 online"}
              </p>
            ) : (
              <p className="text-xs text-gray-500">{isOnline ? "● online" : "offline"}</p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="text-gray-600 hover:text-purple-600 p-1 hover:bg-white/30 rounded-full transition-all duration-300 transform hover:scale-110"
          title="Search"
        >
          🔍
        </button>
        <button
          onClick={() => setShowGifPicker(!showGifPicker)}
          className="text-gray-600 hover:text-purple-600 p-1 hover:bg-white/30 rounded-full transition-all duration-300 transform hover:scale-110"
          title="GIF"
        >
          GIF
        </button>

        {/* Room menu */}
        <div className="relative">
          <button
            onClick={() => setShowRoomMenu(!showRoomMenu)}
            className="text-gray-600 hover:text-purple-600 p-1 hover:bg-white/30 rounded-full transition-all duration-300 transform hover:scale-110"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
          {showRoomMenu && (
            <div className="absolute right-0 top-8 bg-white/80 backdrop-blur-xl border border-white/20 rounded-lg shadow-lg z-10 min-w-36 py-1 animate-fadeIn">
              {selectedRoom.is_group ? (
                selectedRoom.creator_id === user?.id && (
                  <button
                    onClick={handleDeleteRoom}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-white/40 transition-all duration-300"
                  >
                    Delete Group
                  </button>
                )
              ) : (
                <button
                  onClick={handleDeleteRoom}
                  className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-white/40 transition-all duration-300"
                >
                  Delete Chat
                </button>
              )}
            </div>
          )}
        </div>

        {/* Language toggle */}
        <button
          onClick={toggleMessageLanguage}
          className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full hover:bg-purple-200 transition-all duration-300 transform hover:scale-105"
        >
          {messageTargetLang === 'en' ? 'EN' : messageTargetLang === 'hi' ? 'हिन्दी' : 'ಕನ್ನಡ'}
        </button>
        {isTranslating && <span className="text-xs text-purple-500 animate-pulse">Translating...</span>}
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="border-b border-white/20 bg-white/10 backdrop-blur-sm animate-slideDown">
          <SearchBar
            roomId={selectedRoom.id}
            onResults={(data) => setSearchResults(data)}
            onClose={() => {
              setShowSearch(false);
              setSearchResults([]);
            }}
          />
        </div>
      )}

      {/* Search results */}
      {searchResults.length > 0 && (
        <div className="p-2 border-b border-white/20 max-h-40 overflow-y-auto bg-white/10 backdrop-blur-sm animate-fadeIn">
          {searchResults.map(msg => (
            <div
              key={msg.id}
              className="p-1 hover:bg-white/20 cursor-pointer text-sm transition-all duration-300 rounded"
            >
              <span className="font-bold">{msg.sender?.username}:</span> {msg.content}
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loadingMessages && <p className="text-gray-400 text-center animate-pulse">Loading messages...</p>}
        {messages.map((msg) => {
          const isMine = msg.sender?.id === user?.id;
          const suggestions = messageSuggestions?.[msg.id];
          const displayContent = getDisplayContent(msg, selectedRoom.id);
          const isEditing = editingMessageId === msg.id;

          return (
            <div
              key={msg.id}
              className={`flex ${isMine ? "justify-end" : "justify-start"} animate-fadeIn`}
              onContextMenu={(e) => handleContextMenu(e, msg)}
            >
              <div className="max-w-xs relative group">
                {/* Forward icon (for received messages) */}
                {!isMine && !msg.is_deleted && !isEditing && (
                  <button
                    onClick={() => handleForward(msg)}
                    className="absolute -top-2 -right-10 bg-white/80 backdrop-blur-sm rounded-full w-6 h-6 flex items-center justify-center shadow-md text-gray-600 hover:bg-white opacity-0 group-hover:opacity-100 transition-all duration-300 transform hover:scale-110 z-10"
                    title="Forward"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                  </button>
                )}

                {/* Message bubble */}
                {!msg.is_deleted ? (
                  isEditing ? (
                    <div className={`p-3 rounded-2xl shadow-sm ${
                      isMine
                        ? "bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
                        : "bg-white/80 backdrop-blur-sm border border-white/30"
                    }`}>
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => handleEditKeyDown(e, msg.id)}
                        className="w-full bg-transparent border-b border-white/30 focus:outline-none text-sm px-0 py-1 text-white placeholder-white/50"
                        autoFocus
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          onClick={() => saveEdit(msg.id)}
                          className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 transition-all duration-300"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => handleDelete(msg.id)}
                          className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 transition-all duration-300"
                        >
                          Delete
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="text-xs bg-gray-300 px-2 py-1 rounded hover:bg-gray-400 transition-all duration-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`p-3 rounded-2xl shadow-sm transition-all duration-300 hover:shadow-xl ${
                        isMine
                          ? "bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
                          : "bg-white/80 backdrop-blur-sm border border-white/30 hover:bg-white/90"
                      }`}
                    >
                      {msg.reply_to && (
                        <div className="text-xs border-l-2 border-gray-400 pl-2 mb-1 opacity-75">
                          <span className="font-bold">{msg.reply_to.sender_username}:</span> {msg.reply_to.content}
                        </div>
                      )}
                      {msg.message_type === 'text' && msg.content && (
                        <p className="text-sm break-words">{displayContent}</p>
                      )}
                      {msg.message_type === 'sticker' && (
                        <img src={msg.content} alt="sticker" className="max-w-xs hover:scale-105 transition-transform duration-300" />
                      )}
                      {msg.message_type === 'gif' && (
                        <img src={msg.gif_url || msg.content} alt="gif" className="max-w-xs hover:scale-105 transition-transform duration-300" />
                      )}
                      {msg.message_type === 'voice' && (
                        <AudioMessage src={msg.file_url} />
                      )}
                      {msg.file && msg.message_type !== 'voice' && (
                        <div className="mt-2">
                          {msg.mime_type?.startsWith('image/') ? (
                            <img
                              src={msg.file_url}
                              alt={msg.file_name}
                              className="max-w-full rounded-lg hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <a
                              href={msg.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 p-2 bg-white/30 backdrop-blur-sm rounded-lg hover:bg-white/40 transition-all duration-300"
                            >
                              <svg className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                              <span className="text-sm text-gray-700 truncate">{msg.file_name}</span>
                            </a>
                          )}
                        </div>
                      )}
                      {msg.forwarded && <span className="text-xs text-gray-400 ml-1">Forwarded</span>}
                      {msg.edited && <span className="text-xs text-gray-400 ml-1">(edited)</span>}
                      {msg.pinned && <span className="text-xs text-yellow-600 ml-1 animate-pulse">📌 Pinned</span>}
                      <div className="flex justify-end items-center gap-1 text-xs mt-1 text-gray-500">
                        <span className={isMine ? "text-purple-200" : "text-gray-400"}>{formatTime(msg.created_at)}</span>
                        {isMine && <TickIndicator msg={msg} />}
                      </div>
                      <ReactionDisplay reactions={msg.reactions} />
                    </div>
                  )
                ) : (
                  <div className="p-3 rounded-2xl bg-white/30 backdrop-blur-sm text-gray-500 italic border border-white/20 animate-fadeIn">
                    This message was deleted
                  </div>
                )}

                {/* Three‑dots menu button */}
                {isMine && !msg.is_deleted && !isEditing && (
                  <button
                    onClick={() => setActiveMenuMsgId(activeMenuMsgId === msg.id ? null : msg.id)}
                    className="absolute -top-2 right-0 bg-white/80 backdrop-blur-sm rounded-full w-6 h-6 flex items-center justify-center shadow-md text-gray-600 hover:bg-white opacity-0 group-hover:opacity-100 transition-all duration-300 transform hover:scale-110"
                  >
                    ⋮
                  </button>
                )}

                {/* Action menu dropdown */}
                {activeMenuMsgId === msg.id && (
                  <div
                    ref={menuRef}
                    className="absolute right-0 top-6 bg-white/80 backdrop-blur-xl border border-white/20 rounded-lg shadow-xl z-50 min-w-36 py-1 animate-fadeIn"
                  >
                    {isMine && (
                      <>
                        <button
                          onClick={() => startEditing(msg)}
                          className="block w-full text-left px-4 py-2 text-sm hover:bg-white/40 transition-all duration-300"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(msg.id)}
                          className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-white/40 transition-all duration-300"
                        >
                          Delete
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setReplyTo(msg)}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-white/40 transition-all duration-300"
                    >
                      Reply
                    </button>
                    <button
                      onClick={() => handleForward(msg)}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-white/40 transition-all duration-300"
                    >
                      Forward
                    </button>
                    <button
                      onClick={() => handleCopy(msg.content)}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-white/40 transition-all duration-300"
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => setShowEmojiPickerFor(msg.id)}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-white/40 transition-all duration-300"
                    >
                      Emoji
                    </button>
                    {selectedRoom.is_group && selectedRoom.creator_id === user?.id && (
                      <button
                        onClick={() => handlePin(msg.id, msg.pinned)}
                        className="block w-full text-left px-4 py-2 text-sm hover:bg-white/40 transition-all duration-300"
                      >
                        {msg.pinned ? 'Unpin' : 'Pin'}
                      </button>
                    )}
                  </div>
                )}

                {/* Emoji picker */}
                {showEmojiPickerFor === msg.id && (
                  <div className="absolute bottom-8 right-0 bg-white/80 backdrop-blur-xl border border-white/20 rounded-lg shadow-lg p-2 z-50 flex gap-1 animate-fadeIn">
                    {['👍', '❤️', '😂', '😮', '😢', '😡'].map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => handleEmojiSelect(emoji, msg.id)}
                        className="text-xl hover:bg-white/40 w-8 h-8 rounded transition-all duration-300 transform hover:scale-125"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                {/* AI suggestions */}
                {!isMine && !msg.is_deleted && suggestions && !isEditing && (
                  <div className="mt-2 flex flex-wrap gap-2 animate-fadeIn">
                    {suggestions.replies?.map((reply, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setNewMessage(reply); inputRef.current?.focus(); }}
                        className="px-3 py-1 bg-purple-100/70 backdrop-blur-sm text-purple-700 text-xs rounded-full hover:bg-purple-200/70 border border-purple-200 transition-all duration-300 transform hover:scale-105"
                      >
                        {reply}
                      </button>
                    ))}
                    {suggestions.suggestions?.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setNewMessage(suggestion); inputRef.current?.focus(); }}
                        className="px-3 py-1 bg-indigo-100/70 backdrop-blur-sm text-indigo-700 text-xs rounded-full hover:bg-indigo-200/70 border border-indigo-200 transition-all duration-300 transform hover:scale-105"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply preview */}
      <ReplyPreview replyTo={replyTo} onCancel={() => setReplyTo(null)} />

      {/* GIF picker */}
      {showGifPicker && (
        <GifPicker
          onSelect={(url) => {
            const ws = socketRef.current;
            ws.send(JSON.stringify({
              type: "chat_message",
              message: url,
              message_type: "gif",
              temp_id: Date.now(),
              reply_to_id: replyTo?.id,
            }));
            setShowGifPicker(false);
            setReplyTo(null);
          }}
          onClose={() => setShowGifPicker(false)}
        />
      )}

      {/* Forward modal */}
      <ForwardModal
        isOpen={forwardModal.open}
        onClose={() => setForwardModal({ open: false, message: null })}
        message={forwardModal.message}
      />

      {/* Room details modal */}
      {showRoomDetails && (
        <RoomDetails
          room={selectedRoom}
          onClose={() => setShowRoomDetails(false)}
          onUpdate={() => {}}
        />
      )}

      {/* Input area */}
      <div className="p-4 border-t border-white/20 bg-white/10 backdrop-blur-sm shrink-0">
        {uploading && (
          <div className="mb-2 animate-pulse">
            <div className="h-2 bg-gray-200/50 rounded">
              <div className="h-2 bg-purple-600 rounded transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-1">Uploading... {uploadProgress}%</p>
          </div>
        )}
        <div className="relative">
          <MentionSuggestions
            suggestions={mentionSuggestions}
            onSelect={(username) => {
              const words = newMessage.split(' ');
              words[words.length - 1] = `@${username}`;
              setNewMessage(words.join(' '));
              setMentionSuggestions([]);
            }}
          />
          <div className="flex gap-2 items-center">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                value={newMessage}
                onChange={handleTyping}
                onKeyDown={handleKeyDown}
                className="w-full border border-white/30 bg-white/40 backdrop-blur-sm rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300 transition-all duration-300 placeholder:text-gray-500"
                placeholder="Type a message..."
                disabled={uploading}
              />
              {ghostSuggestion && newMessage.trim() !== "" && (
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 pointer-events-none animate-pulse">
                  <span className="text-purple-600 font-medium">{newMessage}</span>
                  <span className="text-purple-300 italic">{ghostSuggestion}</span>
                </div>
              )}
            </div>
            <VoiceRecorder onSend={handleVoiceSend} />
            <button
              onClick={() => fileInputRef.current.click()}
              className="p-2 text-gray-600 hover:text-purple-600 transition-all duration-300 transform hover:scale-110"
              title="Attach file"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
              </svg>
            </button>
            <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" />
            <button
              disabled={!isSocketReady || uploading}
              onClick={handleSend}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-5 py-2 rounded-full hover:opacity-90 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-purple-500/30 transition-all duration-300 transform hover:scale-105"
            >
              {uploading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Uploading...
                </>
              ) : (
                "Send"
              )}
            </button>
          </div>
        </div>
        {ghostSuggestion && newMessage.trim() !== "" && (
          <p className="text-xs text-purple-400 mt-1 animate-pulse">Press Tab to accept suggestion</p>
        )}
      </div>
    </div>
  );
}