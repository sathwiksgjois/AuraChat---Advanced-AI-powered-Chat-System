export default function ReplyPreview({ replyTo, onCancel }) {
  if (!replyTo) return null;
  return (
    <div className="p-2 bg-gray-100 border-l-4 border-purple-600 flex justify-between items-center">
      <div>
        <p className="text-xs text-gray-600">Replying to {replyTo.sender_username}</p>
        <p className="text-sm truncate max-w-md">{replyTo.content}</p>
      </div>
      <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">✕</button>
    </div>
  );
}