import { useContext, useState, useEffect } from 'react';
import { ChatContext } from '../../context/ChatContext';
import { AuthContext } from '../../context/AuthContext';
import { ContactsContext } from '../../context/ContactContext';
import axios from '../../api/axios';

export default function RoomDetails({ room, onClose, onUpdate }) {
  const { user } = useContext(AuthContext);
  const { contacts } = useContext(ContactsContext);
  const { refreshRooms } = useContext(ChatContext);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newMemberSearch, setNewMemberSearch] = useState('');
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (room.is_group) {
      fetchMembers();
    }
  }, [room]);

  // Filter contacts based on search term and exclude existing members
  useEffect(() => {
    if (!showAddMember) return;
    const term = newMemberSearch.toLowerCase().trim();
    const memberIds = new Set(members.map(m => m.user?.id));
    const filtered = contacts.filter(contact => {
      const name = (contact.nickname || contact.username || '').toLowerCase();
      return name.includes(term) && !memberIds.has(contact.user_id);
    });
    setFilteredContacts(filtered);
  }, [newMemberSearch, contacts, members, showAddMember]);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`chat/rooms/${room.id}/members/`);
      // Handle paginated or direct array response
      if (res.data?.results && Array.isArray(res.data.results)) {
        setMembers(res.data.results);
      } else if (Array.isArray(res.data)) {
        setMembers(res.data);
      } else {
        setMembers([]);
      }
      setError(null);
    } catch (err) {
      console.error('Failed to fetch members', err);
      setError('Could not load members');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const addMember = async (userId) => {
    setAdding(true);
    try {
      await axios.post(`chat/rooms/${room.id}/add_member/`, { user_id: userId });
      await fetchMembers();
      setShowAddMember(false);
      setNewMemberSearch('');
      onUpdate();
    } catch (err) {
      console.error('Failed to add member', err);
    } finally {
      setAdding(false);
    }
  };

  const removeMember = async (userId) => {
    if (!window.confirm('Remove this member?')) return;
    try {
      await axios.post(`chat/rooms/${room.id}/remove_member/`, { user_id: userId });
      await fetchMembers();
      onUpdate();
    } catch (err) {
      console.error('Failed to remove member', err);
    }
  };

  const promoteToAdmin = async (userId) => {
    try {
      await axios.post(`chat/rooms/${room.id}/promote_admin/`, { user_id: userId });
      await fetchMembers();
    } catch (err) {
      console.error('Failed to promote', err);
    }
  };

  const exitGroup = async () => {
    if (!window.confirm('Leave this group?')) return;
    try {
      await axios.post(`chat/rooms/${room.id}/exit/`);
      await refreshRooms();
      onClose();
      window.location.href = '/';
    } catch (err) {
      console.error('Failed to exit group', err);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
      <div className="w-96 h-full bg-white shadow-xl overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">Room Info</h2>
          <button onClick={onClose} className="text-gray-500 text-2xl">&times;</button>
        </div>

        <div className="p-4">
          {/* Room avatar and name */}
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full overflow-hidden">
              {room.avatar ? (
                <img src={room.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-400 to-indigo-400 flex items-center justify-center text-white text-2xl font-bold">
                  {room.display_name?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-lg">{room.display_name}</h3>
              {room.is_group && <p className="text-sm text-gray-500">{members.length} members</p>}
            </div>
          </div>

          {/* Group members */}
          {room.is_group && (
            <div className="mt-6">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold">Members</h4>
                {room.creator_id === user?.id && (
                  <button
                    onClick={() => setShowAddMember(true)}
                    className="text-sm bg-purple-600 text-white px-3 py-1 rounded"
                  >
                    Add Member
                  </button>
                )}
              </div>

              {/* Add member form with local contact filtering */}
              {showAddMember && (
                <div className="mb-4 p-2 border rounded">
                  <input
                    type="text"
                    placeholder="Search contacts..."
                    value={newMemberSearch}
                    onChange={(e) => setNewMemberSearch(e.target.value)}
                    className="w-full border p-2 rounded mb-2"
                  />
                  {filteredContacts.map(contact => (
                    <div key={contact.id} className="flex justify-between items-center p-2 hover:bg-gray-50">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-300">
                          {contact.avatar ? (
                            <img src={contact.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gray-400 flex items-center justify-center text-white text-xs font-bold">
                              {(contact.nickname || contact.username).charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <span>{contact.nickname || contact.username}</span>
                      </div>
                      <button
                        onClick={() => addMember(contact.user_id)}
                        disabled={adding}
                        className="text-xs bg-green-500 text-white px-2 py-1 rounded"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                  {filteredContacts.length === 0 && newMemberSearch && (
                    <p className="text-gray-500 text-sm p-2">No contacts found</p>
                  )}
                  <button onClick={() => setShowAddMember(false)} className="text-xs text-gray-500 mt-2">Cancel</button>
                </div>
              )}

              {/* Member list */}
              {loading ? (
                <div className="flex justify-center p-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                </div>
              ) : error ? (
                <p className="text-red-500 text-center p-4">{error}</p>
              ) : (
                <div className="space-y-2">
                  {members.map(member => (
                    <div key={member.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full overflow-hidden">
                          {member.user?.avatar ? (
                            <img src={member.user.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gray-300 flex items-center justify-center text-sm font-bold">
                              {member.user?.username?.charAt(0).toUpperCase() || '?'}
                            </div>
                          )}
                        </div>
                        <div>
                          <span className="font-medium">{member.user?.full_name || member.user?.username || 'Unknown'}</span>
                          {member.user?.id === room.creator_id && (
                            <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Admin</span>
                          )}
                          <div className="text-xs text-gray-500">
                            Joined {formatDate(member.joined_at)}
                          </div>
                        </div>
                      </div>
                      {room.creator_id === user?.id && member.user?.id !== user.id && (
                        <div className="flex gap-2">
                          {member.user?.id !== room.creator_id && (
                            <button
                              onClick={() => promoteToAdmin(member.user.id)}
                              className="text-xs text-blue-600"
                              title="Make admin"
                            >
                              👑
                            </button>
                          )}
                          <button
                            onClick={() => removeMember(member.user.id)}
                            className="text-xs text-red-600"
                            title="Remove"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Exit group button (non‑admin) */}
              {room.creator_id !== user?.id && (
                <button
                  onClick={exitGroup}
                  className="mt-4 w-full bg-red-500 text-white py-2 rounded"
                >
                  Exit Group
                </button>
              )}
            </div>
          )}

          {/* Private chat: show user profile */}
          {!room.is_group && (
            <div className="mt-6">
              <h4 className="font-semibold mb-2">Contact Info</h4>
              <p>Username: {room.display_name}</p>
              <p>Last seen: {room.last_seen ? new Date(room.last_seen).toLocaleString() : 'Unknown'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}