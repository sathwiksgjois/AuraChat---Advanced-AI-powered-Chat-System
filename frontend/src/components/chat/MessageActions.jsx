import { useState, useRef, useEffect } from 'react';

export default function MessageActions({ message, onEdit, onDelete }) {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const menuRef = useRef();
  const inputRef = useRef();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleEdit = () => {
    setShowMenu(false);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSaveEdit = () => {
    if (editText.trim() && editText !== message.content) {
      onEdit(message.id, editText);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditText(message.content);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleDelete = () => {
    if (window.confirm('Delete this message?')) {
      onDelete(message.id);
    }
    setShowMenu(false);
  };

  if (isEditing) {
    return (
      <div className="mt-1">
        <input
          ref={inputRef}
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={handleKeyDown}
          className="border rounded px-2 py-1 w-full text-sm"
          autoFocus
        />
        <div className="flex gap-2 mt-1">
          <button onClick={handleSaveEdit} className="text-xs bg-green-500 text-white px-2 py-1 rounded">Save</button>
          <button onClick={handleCancelEdit} className="text-xs bg-gray-300 px-2 py-1 rounded">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Three‑dot button – now always visible with better contrast */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="text-gray-600 hover:text-gray-900 bg-white bg-opacity-80 rounded-full w-6 h-6 flex items-center justify-center shadow-sm"
        title="Message actions"
      >
        ⋮
      </button>
      {showMenu && (
        <div className="absolute right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 min-w-28 py-1">
          <button
            onClick={handleEdit}
            className="block px-4 py-2 text-sm hover:bg-gray-100 w-full text-left"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="block px-4 py-2 text-sm text-red-600 hover:bg-gray-100 w-full text-left"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}