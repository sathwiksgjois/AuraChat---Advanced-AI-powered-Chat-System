import { useState, useContext, useMemo, useRef, useEffect } from 'react';
import { ChatContext } from '../../context/ChatContext';
import { ContactsContext } from '../../context/ContactContext';
import { useNavigate } from 'react-router-dom';
import axios from '../../api/axios';

export default function CreateGroupModal({ isOpen, onClose }) {
  const [groupName, setGroupName] = useState('');
  const [groupAvatar, setGroupAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [loading, setLoading] = useState(false);

  const { contacts, loading: contactsLoading, fetchContacts } =
    useContext(ContactsContext);

  const { refreshRooms } = useContext(ChatContext);
  const navigate = useNavigate();
  const fileInputRef = useRef();

  // ✅ Fetch contacts whenever modal opens
  useEffect(() => {
    if (isOpen) {
      fetchContacts?.();
    }
  }, [isOpen]);

  // ✅ Reset modal state when closed
  useEffect(() => {
    if (!isOpen) {
      setGroupName('');
      setGroupAvatar(null);
      setAvatarPreview(null);
      setSearchTerm('');
      setSelectedContacts([]);
    }
  }, [isOpen]);

  // ✅ Safe filtering
  const filteredContacts = useMemo(() => {
    if (!contacts || !Array.isArray(contacts)) return [];

    return contacts.filter((contact) => {
      const name = (contact.nickname || contact.username || '')
        .toLowerCase()
        .trim();

      return name.includes(searchTerm.toLowerCase().trim());
    });
  }, [contacts, searchTerm]);

  const toggleContact = (userId) => {
    setSelectedContacts((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setGroupAvatar(file);

    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const createGroup = async () => {
    if (!groupName.trim() || selectedContacts.length === 0) return;

    setLoading(true);

    const formData = new FormData();
    formData.append('name', groupName.trim());
    formData.append('user_ids', JSON.stringify(selectedContacts));

    if (groupAvatar) {
      formData.append('avatar', groupAvatar);
    }

    try {
      const response = await axios.post('chat/group/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await refreshRooms();
      onClose();
      navigate(`/chat/${response.data.id}`);
    } catch (err) {
      console.error('Failed to create group:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="p-4 border-b">
          <h2 className="text-xl font-bold">Create Group</h2>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">

          {/* Avatar */}
          <div className="flex flex-col items-center mb-4">
            <div className="relative w-20 h-20 mb-2">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-purple-200">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="group avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-400 to-indigo-400 flex items-center justify-center text-white text-2xl font-bold">
                    {groupName?.charAt(0)?.toUpperCase() || 'G'}
                  </div>
                )}
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 bg-purple-600 text-white rounded-full p-1.5 shadow-md"
              >
                ✎
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Group Name */}
          <input
            type="text"
            placeholder="Group Name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="w-full border rounded-lg p-2 mb-4"
          />

          {/* Search */}
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border rounded-lg p-2 bg-gray-50 mb-3"
          />

          {/* Selected Count */}
          <p className="text-sm text-gray-600 mb-2">
            {selectedContacts.length} member
            {selectedContacts.length !== 1 ? 's' : ''} selected
          </p>

          {/* Contact List */}
          <div className="border rounded-lg max-h-60 overflow-y-auto">
            {contactsLoading ? (
              <p className="text-center text-gray-400 p-4">
                Loading contacts...
              </p>
            ) : filteredContacts.length === 0 ? (
              <p className="text-center text-gray-400 p-4">
                No contacts found
              </p>
            ) : (
              filteredContacts.map((contact) => {
                const name = contact.nickname || contact.username || 'User';

                return (
                  <label
                    key={contact.user_id}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedContacts.includes(contact.user_id)}
                      onChange={() => toggleContact(contact.user_id)}
                      className="w-4 h-4"
                    />

                    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                      {contact.avatar ? (
                        <img
                          src={contact.avatar}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-purple-400 to-indigo-400 flex items-center justify-center text-white font-bold">
                          {name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{name}</p>
                      <p className="text-sm text-gray-500 truncate">
                        {contact.phone_number}
                      </p>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 rounded-lg"
          >
            Cancel
          </button>

          <button
            onClick={createGroup}
            disabled={
              loading || !groupName.trim() || selectedContacts.length === 0
            }
            className="px-4 py-2 bg-purple-600 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}