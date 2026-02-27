import React from 'react';

export default function MentionSuggestions({ suggestions, onSelect }) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="absolute bottom-full mb-2 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto z-50 w-full">
      {suggestions.map((user) => (
        <button
          key={user.id}
          onClick={() => onSelect(user.username)}
          className="block w-full text-left px-4 py-2 hover:bg-gray-100 transition"
        >
          {user.username}
        </button>
      ))}
    </div>
  );
}