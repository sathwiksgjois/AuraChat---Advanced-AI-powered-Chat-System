import { useState, useEffect } from 'react';
import axios from '../../api/axios';

export default function StatusView({ statuses, initialIndex, onClose }) {
  const [index, setIndex] = useState(initialIndex);
  const [viewers, setViewers] = useState([]);
  const [showViewers, setShowViewers] = useState(false);
  const status = statuses[index];

  useEffect(() => {
    if (!status) return;
    // Mark as viewed
    axios.post(`/status/${status.id}/view/`).catch(console.error);
    // Fetch viewers (if needed)
    axios.get(`/status/${status.id}/viewers/`).then(res => setViewers(res.data)).catch(console.error);
  }, [status]);

  const handlePrev = () => setIndex((i) => (i > 0 ? i - 1 : statuses.length - 1));
  const handleNext = () => setIndex((i) => (i < statuses.length - 1 ? i + 1 : 0));

  if (!status) return null;

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      <button onClick={onClose} className="absolute top-4 right-4 text-white text-2xl">&times;</button>
      <button onClick={handlePrev} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white text-3xl">‹</button>
      <button onClick={handleNext} className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white text-3xl">›</button>

      <div className="relative max-w-md w-full">
        {/* Header with user info */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/50 to-transparent text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-white">
            {status.user_avatar ? (
              <img src={status.user_avatar} alt={status.username} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-purple-600 flex items-center justify-center text-white font-bold">
                {status.username?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <p className="font-semibold">{status.username}</p>
            <p className="text-xs opacity-80">{new Date(status.created_at).toLocaleString()}</p>
          </div>
          <button onClick={() => setShowViewers(!showViewers)} className="ml-auto text-sm bg-white/20 px-2 py-1 rounded">
            👁 {viewers.length}
          </button>
        </div>

        {/* Status content */}
        <div className="flex items-center justify-center min-h-screen">
          {status.file && status.file.match(/\.(mp4|webm|ogg)$/i) ? (
            <video src={status.file} autoPlay controls className="max-h-screen" />
          ) : status.file ? (
            <img src={status.file} alt="status" className="max-h-screen" />
          ) : (
            <div className="text-white text-2xl p-8 text-center bg-gray-900 rounded-lg">{status.content}</div>
          )}
        </div>

        {/* Viewers list */}
        {showViewers && (
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-xl p-4 max-h-64 overflow-y-auto">
            <h4 className="font-semibold mb-2">Viewed by</h4>
            {viewers.map(v => (
              <div key={v.id} className="flex items-center gap-2 py-1">
                <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-300">
                  {v.avatar ? <img src={v.avatar} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-400" />}
                </div>
                <span>{v.username}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}