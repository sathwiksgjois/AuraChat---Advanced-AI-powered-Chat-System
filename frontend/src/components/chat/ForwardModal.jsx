import { useState, useContext, useMemo } from 'react';
import { ChatContext } from '../../context/ChatContext';
import { AuthContext } from '../../context/AuthContext';
import axios from '../../api/axios';

export default function ForwardModal({ isOpen, onClose, message }) {
  const { rooms, refreshRooms, setSelectedRoom } = useContext(ChatContext);
  const { user } = useContext(AuthContext);
  const [selectedRooms, setSelectedRooms] = useState([]);
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter rooms where user is participant (exclude current room)
  const availableRooms = useMemo(() => {
    return rooms.filter(room => room.id !== message?.room_id);
  }, [rooms, message]);

  const filteredRooms = useMemo(() => {
    if (!searchTerm.trim()) return availableRooms;
    const term = searchTerm.toLowerCase();
    return availableRooms.filter(r => r.display_name?.toLowerCase().includes(term));
  }, [availableRooms, searchTerm]);

  const toggleRoom = (roomId) => {
    setSelectedRooms(prev =>
      prev.includes(roomId) ? prev.filter(id => id !== roomId) : [...prev, roomId]
    );
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleForward = async () => {
    if (selectedRooms.length === 0) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('message_id', message.id);
    formData.append('target_room_ids', JSON.stringify(selectedRooms));
    if (caption.trim()) formData.append('caption', caption);
    if (file) formData.append('file', file);

    try {
      await axios.post('/chat/forward-multiple/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await refreshRooms();
      onClose();
    } catch (err) {
      console.error('Forward failed', err);
      alert('Failed to forward message');
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">Forward Message</h2>
          <button onClick={onClose} className="text-gray-500 text-2xl">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Caption / additional message */}
          <textarea
            placeholder="Add a message (optional)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="w-full border rounded p-2 mb-3"
            rows="2"
          />

          {/* File attachment */}
          <div className="mb-3">
            <input
              type="file"
              onChange={handleFileChange}
              className="w-full"
            />
          </div>

          {/* Search rooms */}
          <input
            type="text"
            placeholder="Search chats..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border rounded p-2 mb-2"
          />

          <p className="text-sm text-gray-600 mb-2">
            {selectedRooms.length} room(s) selected
          </p>

          {/* Room list */}
          <div className="border rounded max-h-60 overflow-y-auto">
            {filteredRooms.length === 0 ? (
              <p className="text-center p-4 text-gray-500">No chats available</p>
            ) : (
              filteredRooms.map(room => (
                <label key={room.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0">
                  <input
                    type="checkbox"
                    checked={selectedRooms.includes(room.id)}
                    onChange={() => toggleRoom(room.id)}
                    className="w-4 h-4"
                  />
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                    {room.avatar ? (
                      <img src={room.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-400 to-indigo-400 flex items-center justify-center text-white text-sm font-bold">
                        {room.display_name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="flex-1 truncate">{room.display_name}</span>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded">Cancel</button>
          <button
            onClick={handleForward}
            disabled={selectedRooms.length === 0 || uploading}
            className="px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50"
          >
            {uploading ? 'Forwarding...' : 'Forward'}
          </button>
        </div>
      </div>
    </div>
  );
}