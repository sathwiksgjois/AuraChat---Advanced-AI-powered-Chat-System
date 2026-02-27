import { useContext, useState, useMemo } from "react";
import { ChatContext } from "../../context/ChatContext";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MessageSquare,
  Phone,
  MoreVertical,
  Search,
  Camera,
  Users,
  PlusCircle,
  LogOut,
  User,
  Settings,
  X,
} from "lucide-react";
import Modal from "../ui/Modal";
import ProfileModal from "../ui/ProfileModal";
import Contacts from "../../pages/Contacts";
import CreateGroupModal from "../chat/CreateGroupModal";
import StatusUploadModal from "../status/StatusUploadModal";

export default function Sidebar({ onClose }) {
  const { rooms, selectedRoom, loadingRooms, setSelectedRoom, typingMap, unreadMap } = useContext(ChatContext);
  const { user, onlineUsers, logout } = useContext(AuthContext);
  const { uiLanguage, changeUiLanguage } = useLanguage();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  const totalChats = rooms.length;
  const onlinePrivateCount = useMemo(() => {
    return rooms.filter((room) => !room.is_group && onlineUsers.includes(room.other_user_id)).length;
  }, [rooms, onlineUsers]);

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => room.display_name?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [rooms, searchTerm]);

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffMins < 1440) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (loadingRooms) {
    return (
      <div className="w-80 h-full bg-white/30 backdrop-blur-xl rounded-3xl border border-white/20 p-4 animate-pulse">
        Loading chats...
      </div>
    );
  }

  return (
    <div className="w-80 h-full bg-white/30 backdrop-blur-xl rounded-3xl border border-white/20 flex flex-col overflow-hidden relative shadow-2xl">
      {/* Close button for mobile */}
      <button
        onClick={onClose}
        className="md:hidden absolute top-4 right-4 p-1 rounded-full hover:bg-white/40 transition-all duration-300 z-10"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-white/20">
        <div className="flex items-center gap-2">
          <Avatar className="h-10 w-10 ring-2 ring-purple-500/30 hover:ring-purple-500 transition-all duration-300">
            <AvatarImage src={user?.avatar} />
            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
              {user?.username?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-gray-800">{user?.full_name || user?.username}</p>
            <p className="text-xs text-green-500 animate-pulse">● Online</p>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => setIsStatusModalOpen(true)} className="text-gray-600 hover:text-purple-600 hover:bg-white/30 transition-all duration-300">
            <Camera className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsGroupModalOpen(true)} className="text-gray-600 hover:text-purple-600 hover:bg-white/30 transition-all duration-300">
            <Users className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(true)} className="text-gray-600 hover:text-purple-600 hover:bg-white/30 transition-all duration-300">
            <PlusCircle className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-gray-600 hover:text-purple-600 hover:bg-white/30 transition-all duration-300">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white/80 backdrop-blur-xl border-white/20 animate-fadeIn">
              <DropdownMenuItem onClick={() => setIsProfileModalOpen(true)} className="hover:bg-white/40 transition-all duration-200">
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-white/40 transition-all duration-200">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 hover:bg-white/40 transition-all duration-200">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 py-2 flex justify-between text-sm border-b border-white/20">
        <div className="group cursor-pointer">
          <span className="font-bold group-hover:text-purple-600 transition-all duration-300">{totalChats}</span> CHATS
        </div>
        <div className="group cursor-pointer">
          <span className="font-bold group-hover:text-purple-600 transition-all duration-300">{onlinePrivateCount}</span> ONLINE
        </div>
        <div className="group cursor-pointer">
          <span className="font-bold group-hover:text-purple-600 transition-all duration-300">87</span>{" "}
          <span className="text-gray-500 group-hover:text-gray-700">overall mood</span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="chats" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-transparent">
          <TabsTrigger
            value="chats"
            className="data-[state=active]:bg-white/40 data-[state=active]:backdrop-blur-sm transition-all duration-300 hover:bg-white/20"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Chats
          </TabsTrigger>
          <TabsTrigger
            value="status"
            className="data-[state=active]:bg-white/40 data-[state=active]:backdrop-blur-sm transition-all duration-300 hover:bg-white/20"
          >
            <Camera className="h-4 w-4 mr-2" />
            Status
          </TabsTrigger>
          <TabsTrigger
            value="calls"
            className="data-[state=active]:bg-white/40 data-[state=active]:backdrop-blur-sm transition-all duration-300 hover:bg-white/20"
          >
            <Phone className="h-4 w-4 mr-2" />
            Calls
          </TabsTrigger>
        </TabsList>

        {/* Search */}
        <div className="p-4">
          <div className="relative group">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400 group-focus-within:text-purple-500 transition-colors duration-300" />
            <Input
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 bg-white/40 backdrop-blur-sm border-white/30 placeholder:text-gray-500 focus:ring-2 focus:ring-purple-300 transition-all duration-300"
            />
          </div>
        </div>

        {/* Chats Tab */}
        <TabsContent value="chats" className="flex-1 overflow-hidden">
          <ScrollArea className="h-[calc(100vh-240px)] px-2">
            <div className="space-y-1">
              {filteredRooms.map((room) => {
                const isPrivate = !room.is_group;
                const isOnline = isPrivate && onlineUsers.includes(room.other_user_id);
                const lastMessageTime = formatTime(room.last_message_time);
                const mood = room.mood;
                const roomTypingUsers = typingMap[room.id] || {};
                const typingUsers = Object.values(roomTypingUsers);
                const typingText = typingUsers.length > 0
                  ? (typingUsers.length === 1 ? `${typingUsers[0]} is typing...` : `${typingUsers.join(', ')} are typing...`)
                  : null;
                const unreadCount = unreadMap[room.id] || 0;

                return (
                  <div
                    key={room.id}
                    onClick={() => {
                      setSelectedRoom(room);
                      navigate(`/chat/${room.id}`);
                    }}
                    className={`p-3 rounded-lg cursor-pointer transition-all duration-300 flex items-center gap-3 transform hover:scale-[1.02] ${
                      selectedRoom?.id === room.id
                        ? "bg-white/40 backdrop-blur-sm shadow-lg"
                        : "hover:bg-white/20 hover:shadow-md"
                    }`}
                  >
                    <div className="relative">
                      <Avatar className="h-12 w-12 ring-2 ring-transparent hover:ring-purple-500 transition-all duration-300">
                        <AvatarImage src={room.avatar || room.other_user_avatar} />
                        <AvatarFallback className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
                          {room.display_name?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {isOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full animate-pulse" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <p className="font-medium truncate text-gray-800">{room.display_name}</p>
                        <p className="text-xs text-gray-500">{lastMessageTime}</p>
                      </div>
                      <div className="flex justify-between items-center text-sm mt-1">
                        <p className={`truncate w-40 transition-all duration-300 ${
                          typingText ? "text-green-500 italic animate-pulse" : "text-gray-600"
                        }`}>
                          {typingText || room.last_message || "No messages yet"}
                        </p>
                        <div className="flex items-center gap-2">
                          {mood !== undefined && (
                            <span className="text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors duration-300">
                              {mood}%
                            </span>
                          )}
                          {unreadCount > 0 && (
                            <span className="bg-purple-600 text-white rounded-full px-2 py-0.5 text-xs font-semibold animate-bounce">
                              {unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Status Tab */}
        <TabsContent value="status" className="flex-1 overflow-hidden">
          <ScrollArea className="h-[calc(100vh-240px)]">
            <div className="p-2 text-center text-gray-500 animate-pulse">Status coming soon</div>
          </ScrollArea>
        </TabsContent>

        {/* Calls Tab */}
        <TabsContent value="calls" className="flex-1 overflow-hidden">
          <ScrollArea className="h-[calc(100vh-240px)]">
            <div className="p-2 text-center text-gray-500 animate-pulse">Calls coming soon</div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <Contacts hideHeader={true} />
      </Modal>
      <CreateGroupModal isOpen={isGroupModalOpen} onClose={() => setIsGroupModalOpen(false)} />
      <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
      <StatusUploadModal isOpen={isStatusModalOpen} onClose={() => setIsStatusModalOpen(false)} />
    </div>
  );
}