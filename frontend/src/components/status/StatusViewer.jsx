import { useState, useEffect, useRef } from 'react';
import axios from '../../api/axios';

export default function StatusViewer({ statuses, initialIndex, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef(null);
  const currentStatus = statuses[currentIndex];

  useEffect(() => {
    // Mark as viewed
    axios.post(`/status/${currentStatus.id}/view/`).catch(console.error);

    // Auto-advance after 5 seconds
    intervalRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          goToNext();
          return 0;
        }
        return prev + 2; // 5 seconds = 100 / 2 * 0.1s? Actually simpler: use setTimeout
      });
    }, 100); // progress bar update every 100ms

    return () => clearInterval(intervalRef.current);
  }, [currentIndex]);

  const goToNext = () => {
    if (currentIndex < statuses.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setProgress(0);
    }
  };

  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 2) {
      goToPrev();
    } else {
      goToNext();
    }
  };

  if (!currentStatus) return null;

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      <div className="relative w-full max-w-md h-full max-h-[80vh] bg-gray-900 rounded-lg overflow-hidden">
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 flex gap-1 p-2 z-10">
          {statuses.map((_, idx) => (
            <div key={idx} className="flex-1 h-1 bg-gray-600 rounded">
              <div
                className="h-full bg-white rounded"
                style={{
                  width: idx === currentIndex ? `${progress}%` : idx < currentIndex ? '100%' : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Status content */}
        <div className="h-full flex items-center justify-center" onClick={handleClick}>
          {currentStatus.file ? (
            currentStatus.file.match(/\.(mp4|webm|ogg)$/i) ? (
              <video src={currentStatus.file} autoPlay className="max-h-full" />
            ) : (
              <img src={currentStatus.file} alt="" className="max-h-full object-contain" />
            )
          ) : (
            <div className="text-white text-2xl p-4 text-center">{currentStatus.content}</div>
          )}
        </div>

        {/* User info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full overflow-hidden">
              {currentStatus.user_avatar ? (
                <img src={currentStatus.user_avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-purple-600 flex items-center justify-center text-white text-sm font-bold">
                  {currentStatus.username?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <span className="text-white font-medium">{currentStatus.username}</span>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-white text-2xl z-10"
        >
          &times;
        </button>
      </div>
    </div>
  );
}