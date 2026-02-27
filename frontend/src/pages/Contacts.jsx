import { useContext, useState, useMemo } from "react";
import axios from "../api/axios";
import { ContactsContext } from "../context/ContactContext";
import { ChatContext } from "../context/ChatContext";
import { useNavigate } from "react-router-dom";

export default function Contacts({ hideHeader = false, onChatStarted }) {
  const { contacts, loading, fetchContacts } = useContext(ContactsContext);
  const { setSelectedRoom, refreshRooms, rooms } = useContext(ChatContext);
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [phone, setPhone] = useState("");
  const [nickname, setNickname] = useState("");
  const [adding, setAdding] = useState(false);
  const [creating, setCreating] = useState(false);

  const filteredContacts = useMemo(() => {
    if (!searchTerm.trim()) return contacts;
    const term = searchTerm.toLowerCase();
    return contacts.filter(c =>
      (c.nickname || c.username).toLowerCase().includes(term) ||
      (c.phone_number || '').toLowerCase().includes(term)
    );
  }, [contacts, searchTerm]);

  const handleAddContact = async (e) => {
    e.preventDefault();
    if (!phone.trim()) {
      alert("Phone number is required");
      return;
    }
    setAdding(true);
    try {
      await axios.post("/contacts/add/", { 
        phone_number: phone, 
        nickname: nickname || undefined 
      });
      setPhone(""); 
      setNickname("");
      await fetchContacts(); // refresh contact list
      alert("Contact added successfully");
    } catch (err) {
      console.error("Add contact error:", err.response?.data);
      const errorMsg = err.response?.data?.detail || 
                       err.response?.data?.phone_number?.[0] || 
                       "Failed to add contact. Check the phone number.";
      alert(errorMsg);
    } finally {
      setAdding(false);
    }
  };

  const startPrivateChat = async (userId) => {
    setCreating(true);
    try {
      const res = await axios.post("chat/private/", { user_id: userId });
      const roomId = res.data.room_id;
      
      // Refresh rooms list to ensure the new room is loaded
      await refreshRooms();
      
      // Find the newly created room in the rooms list
      const newRoom = rooms.find(r => r.id === roomId);
      if (newRoom) {
        setSelectedRoom(newRoom);
        navigate(`/chat/${roomId}`);
      } else {
        // If room not found yet, wait a bit and try again (could be async state delay)
        setTimeout(() => {
          const room = rooms.find(r => r.id === roomId);
          if (room) {
            setSelectedRoom(room);
            navigate(`/chat/${roomId}`);
          } else {
            // Fallback: just navigate by ID – the ChatWindow will load it via URL param
            navigate(`/chat/${roomId}`);
          }
        }, 100);
      }
      
      if (onChatStarted) onChatStarted();
    } catch (err) {
      console.error("Error creating private chat", err);
      alert(err.response?.data?.detail || "Failed to start chat");
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <p>Loading contacts...</p>;

  return (
    <div className={hideHeader ? "p-2" : "p-6"}>
      {!hideHeader && <h2 className="text-2xl font-semibold mb-6">Contacts</h2>}
      
      {/* Add Contact Form */}
      <form onSubmit={handleAddContact} className="mb-6 space-y-3">
        <input
          type="text"
          placeholder="Phone Number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="border p-2 rounded w-full"
          required
        />
        <input
          type="text"
          placeholder="Nickname (optional)"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="border p-2 rounded w-full"
        />
        <button 
          type="submit" 
          disabled={adding}
          className="bg-purple-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {adding ? "Adding..." : "Add Contact"}
        </button>
      </form>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search contacts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-2 border rounded"
        />
      </div>

      {/* Contact List */}
      <div className="space-y-3">
        {filteredContacts.length === 0 ? (
          <p className="text-gray-500 text-center">No contacts found</p>
        ) : (
          filteredContacts.map(contact => (
            <div key={contact.id} className="border p-4 rounded flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-300">
                  {contact.avatar ? (
                    <img src={contact.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-400 to-indigo-400 flex items-center justify-center text-white font-bold">
                      {(contact.nickname || contact.username).charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-medium">{contact.nickname || contact.username}</p>
                  <p className="text-sm text-gray-500">{contact.phone_number}</p>
                </div>
              </div>
              <button
                onClick={() => startPrivateChat(contact.user_id)}
                disabled={creating}
                className="bg-blue-500 text-white px-3 py-1 rounded disabled:opacity-50"
              >
                {creating ? "Creating..." : "Chat"}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}