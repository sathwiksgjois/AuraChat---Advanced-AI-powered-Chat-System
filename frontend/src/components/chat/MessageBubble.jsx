import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  MoreHorizontal,
  Reply,
  Copy,
  Trash2,
  Edit,
  Pin,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AudioMessage from "./AudioMessage";

export default function MessageBubble({
  msg,
  isMine,
  displayContent,
  formatTime,
  TickIndicator,
  onReply,
  onEdit,
  onDelete,
  onCopy,
  onForward,
  onEmoji,
  onPin,
  showPin,
}) {
  const renderReactions = () => {
    if (!msg.reactions?.length) return null;
    const grouped = msg.reactions.reduce((acc, r) => {
      acc[r.emoji] = (acc[r.emoji] || 0) + 1;
      return acc;
    }, {});
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {Object.entries(grouped).map(([emoji, count]) => (
          <span key={emoji} className="text-xs bg-muted rounded-full px-2 py-0.5">
            {emoji} {count > 1 ? count : ''}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className={cn("flex", isMine ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-xs relative group", isMine ? "order-2" : "order-1")}>
        {!isMine && (
          <Avatar className="absolute -left-12 bottom-0 w-8 h-8">
            <AvatarImage src={msg.sender?.avatar} />
            <AvatarFallback>{msg.sender?.username?.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
        )}

        <div
          className={cn(
            "p-3 rounded-2xl shadow-sm",
            isMine
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground"
          )}
        >
          {msg.reply_to && (
            <div className="text-xs border-l-2 border-muted-foreground pl-2 mb-1 opacity-75">
              <span className="font-bold">{msg.reply_to.sender_username}:</span> {msg.reply_to.content}
            </div>
          )}
          {msg.message_type === 'text' && msg.content && (
            <p className="text-sm break-words">{displayContent}</p>
          )}
          {msg.message_type === 'sticker' && (
            <img src={msg.content} alt="sticker" className="max-w-xs" />
          )}
          {msg.message_type === 'gif' && (
            <img src={msg.gif_url || msg.content} alt="gif" className="max-w-xs" />
          )}
          {msg.message_type === 'voice' && (
            <AudioMessage src={msg.file_url} />
          )}
          {msg.file && msg.message_type !== 'voice' && (
            <div className="mt-2">
              {msg.mime_type?.startsWith('image/') ? (
                <img src={msg.file_url} alt={msg.file_name} className="max-w-full rounded-lg" />
              ) : (
                <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-background rounded-lg hover:bg-muted">
                  <span className="text-sm truncate">{msg.file_name}</span>
                </a>
              )}
            </div>
          )}
          {msg.forwarded && <span className="text-xs text-muted-foreground ml-1">Forwarded</span>}
          {msg.edited && <span className="text-xs text-muted-foreground ml-1">(edited)</span>}
          {msg.pinned && <span className="text-xs text-yellow-600 ml-1">📌 Pinned</span>}
          <div className="flex justify-end items-center gap-1 text-xs mt-1 text-muted-foreground">
            <span>{formatTime(msg.created_at)}</span>
            {isMine && <TickIndicator msg={msg} />}
          </div>
          {renderReactions()}
        </div>

        {/* Action buttons (visible on hover) */}
        <div className="absolute -top-2 right-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-6 w-6 bg-background" onClick={() => onReply(msg)}>
            <Reply className="h-3 w-3" />
          </Button>
          {isMine && (
            <>
              <Button variant="ghost" size="icon" className="h-6 w-6 bg-background" onClick={() => onEdit(msg)}>
                <Edit className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 bg-background" onClick={() => onDelete(msg.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </>
          )}
          {showPin && (
            <Button variant="ghost" size="icon" className="h-6 w-6 bg-background" onClick={() => onPin(msg.id, msg.pinned)}>
              <Pin className={cn("h-3 w-3", msg.pinned && "fill-current")} />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 bg-background">
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onCopy(msg.content)}>
                <Copy className="mr-2 h-4 w-4" /> Copy
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onForward(msg)}>
                Forward
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEmoji(msg.id)}>
                Emoji
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}