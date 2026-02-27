import { useState } from 'react';
import axios from '../../api/axios';

export default function SearchBar({ roomId, onResults, onClose }) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await axios.get(`/chat/rooms/${roomId}/search/?q=${query}`);
      // Handle paginated response (if any)
      const messages = res.data.results || res.data;
      onResults(messages);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 border-b">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        placeholder="Search messages..."
        className="flex-1 border rounded px-2 py-1"
        autoFocus
      />
      <button onClick={handleSearch} disabled={searching} className="bg-purple-600 text-white px-3 py-1 rounded">
        {searching ? '...' : 'Search'}
      </button>
      <button onClick={onClose} className="text-gray-500">✕</button>
    </div>
  );
}