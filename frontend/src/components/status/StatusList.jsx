import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import axios from '../../api/axios';
import StatusViewer from './StatusViewer';

export default function StatusList() {
  const { user } = useContext(AuthContext);
  const [statuses, setStatuses] = useState([]);
  const [groupedStatuses, setGroupedStatuses] = useState([]);
  const [selectedStatusIndex, setSelectedStatusIndex] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    fetchStatuses();
  }, []);

  const fetchStatuses = async () => {
    try {
      const res = await axios.get('/status/');
      setStatuses(res.data);
      // Group by user
      const grouped = res.data.reduce((acc, status) => {
        const userId = status.user;
        if (!acc[userId]) {
          acc[userId] = {
            user: status.user,
            username: status.username,
            avatar: status.user_avatar,
            statuses: [],
          };
        }
        acc[userId].statuses.push(status);
        return acc;
      }, {});
      setGroupedStatuses(Object.values(grouped));
    } catch (err) {
      console.error('Failed to fetch statuses', err);
    }
  };

  const handleStatusClick = (userStatuses) => {
    // Find the first status of that user
    const firstStatus = userStatuses.statuses[0];
    const index = statuses.findIndex(s => s.id === firstStatus.id);
    setSelectedStatusIndex(index);
    setViewerOpen(true);
  };

  const handleCloseViewer = () => {
    setViewerOpen(false);
    setSelectedStatusIndex(null);
    // Optionally refresh statuses to update viewed counts
    fetchStatuses();
  };

  return (
    <>
      <div className="p-4 border-b">
        <h3 className="text-sm font-semibold text-gray-600 mb-2">Status</h3>
        <div className="space-y-2">
          {/* My status */}
          <div
            className="flex items-center gap-3 cursor-pointer hover:bg-gray-100 p-2 rounded"
            onClick={() => {
              // Upload new status
            }}
          >
            <div className="relative">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-purple-500">
                {user?.avatar ? (
                  <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-400 to-indigo-400 flex items-center justify-center text-white font-bold">
                    {user?.username?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <span className="absolute bottom-0 right-0 bg-purple-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs border-2 border-white">
                +
              </span>
            </div>
            <div>
              <p className="font-medium">My status</p>
              <p className="text-xs text-gray-500">Tap to add</p>
            </div>
          </div>

          {/* Contacts' statuses */}
          {groupedStatuses.map(group => (
            <div
              key={group.user}
              className="flex items-center gap-3 cursor-pointer hover:bg-gray-100 p-2 rounded"
              onClick={() => handleStatusClick(group)}
            >
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-green-500">
                {group.avatar ? (
                  <img src={group.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-400 to-indigo-400 flex items-center justify-center text-white font-bold">
                    {group.username?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <p className="font-medium">{group.username}</p>
                <p className="text-xs text-gray-500">
                  {new Date(group.statuses[0].created_at).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Status Viewer Modal */}
      {viewerOpen && selectedStatusIndex !== null && (
        <StatusViewer
          statuses={statuses}
          initialIndex={selectedStatusIndex}
          onClose={handleCloseViewer}
        />
      )}
    </>
  );
}