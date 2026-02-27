const MessageBubble = ({ msg, currentUserId }) => {
  const isMine = msg.sender === currentUserId;

  return (
    <div className={`message ${isMine ? "mine" : ""}`}>
      <div className="content">
        {msg.content}
      </div>

      {isMine && (
        <div className="status">
          {msg.is_read ? (
            <span className="read">✓✓</span>
          ) : msg.is_delivered ? (
            <span className="delivered">✓✓</span>
          ) : (
            <span className="sent">✓</span>
          )}
        </div>
      )}
    </div>
  );
};
