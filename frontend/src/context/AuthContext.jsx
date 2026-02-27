import { createContext, useState, useEffect, useRef } from "react";
import { loginUser, getMe, registerUser } from "../api/authApi";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deliveredMap, setDeliveredMap] = useState({});

  // AI states
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [aiMood, setAiMood] = useState(null);
  const [chatSummary, setChatSummary] = useState(null); // ✅ included

  const globalSocketRef = useRef(null);

  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem("access");
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const data = await getMe();
        setUser(data);
      } catch {
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
      }
      setLoading(false);
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem("access");
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/global/?token=${token}`);
    globalSocketRef.current = ws;

    ws.onopen = () => console.log("Global socket connected");

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("📡 Global socket raw:", data);

      if (data.type === "presence_update") handlePresenceUpdate(data);

      if (data.type === "delivered_receipt") {
        const msgId = parseInt(data.message_id, 10);
        setDeliveredMap((prev) => ({ ...prev, [msgId]: true }));
      }

      if (data.type === "ai_suggestions") setAiSuggestions(data);
      if (data.type === "ai_summary") setAiMood(data);
      if (data.type === "chat_summary") {
        console.log("📝 Chat summary received:", data);
        setChatSummary(data);
      }
    };

    ws.onclose = () => console.log("Global socket disconnected");

    return () => ws.close();
  }, [user]);

  const handlePresenceUpdate = (data) => {
    if (data.is_online) {
      setOnlineUsers((prev) =>
        prev.includes(data.user_id) ? prev : [...prev, data.user_id]
      );
    } else {
      setOnlineUsers((prev) => prev.filter((id) => id !== data.user_id));
    }
  };

  const register = async (formData) => {
    const data = await registerUser(formData);
    localStorage.setItem("access", data.access);
    localStorage.setItem("refresh", data.refresh);
    setUser(data.user);
  };

  const login = async (credentials) => {
    const data = await loginUser(credentials);
    localStorage.setItem("access", data.access);
    localStorage.setItem("refresh", data.refresh);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        loading,
        register,
        onlineUsers,
        globalSocketRef,
        deliveredMap,
        aiSuggestions,
        aiMood,
        chatSummary,
        setChatSummary, 
        setUser
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
}