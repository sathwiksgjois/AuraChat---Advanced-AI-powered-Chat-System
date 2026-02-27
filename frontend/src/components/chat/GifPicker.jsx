import { useState } from 'react';
import axios from '../../api/axios';

export default function GifPicker({ onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      console.log('Searching GIFs for:', query);
      const res = await axios.get(`/chat/giphy/search/?q=${query}`);
      console.log('GIPHY response:', res.data);
      setResults(res.data);
    } catch (err) {
      console.error('GIF search failed:', err);
      setError('Failed to load GIFs. Check console.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute bottom-full mb-2 bg-white border rounded shadow-lg w-80 p-2 z-50">
      <div className="flex gap-2 mb-2">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="Search GIFs..."
          className="border p-1 flex-1"
        />
        <button onClick={search} disabled={loading} className="bg-purple-600 text-white px-2 py-1 rounded">
          {loading ? '...' : 'Go'}
        </button>
        <button onClick={onClose} className="text-gray-500">✕</button>
      </div>
      {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
      <div className="grid grid-cols-2 gap-1 max-h-60 overflow-y-auto">
        {results.map(gif => (
          <img
            key={gif.id}
            src={gif.images.fixed_height_small.url}
            alt=""
            className="cursor-pointer hover:opacity-80"
            onClick={() => onSelect(gif.images.fixed_height.url)}
          />
        ))}
      </div>
    </div>
  );
}