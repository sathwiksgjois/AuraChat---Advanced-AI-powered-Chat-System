import { useContext, useState, useEffect } from "react";
import { AuthContext } from "../../context/AuthContext";
import { ChatContext } from "../../context/ChatContext";
import { useChatActions } from "../../context/ChatActionsContext";
import { Sparkles, Heart, MessageCircle, Activity, FileText, X } from "lucide-react";

export default function AiPanel() {
  const { aiSuggestions, aiMood, chatSummary, setChatSummary } = useContext(AuthContext);
  const { selectedRoom, socketRef } = useContext(ChatContext);
  const { setInputMessage } = useChatActions();
  const [loadingSummary, setLoadingSummary] = useState(false);

  const roomSuggestions = aiSuggestions?.room_id == selectedRoom?.id ? aiSuggestions : null;
  const roomMood = aiMood?.room_id == selectedRoom?.id ? aiMood : null;
  const roomChatSummary = chatSummary?.room_id == selectedRoom?.id ? chatSummary : null;

  useEffect(() => {
    if (roomChatSummary) setLoadingSummary(false);
  }, [roomChatSummary]);

  const requestSummary = () => {
    if (!selectedRoom || !socketRef.current) return;
    setLoadingSummary(true);
    socketRef.current.send(JSON.stringify({ type: "request_summary" }));
  };

  const clearSummary = () => setChatSummary(null);

  const moodScore = roomMood?.summary?.score ?? 87;
  const moodLabel = roomMood?.summary?.label ?? "positive";
  const moodColor =
    moodLabel === "positive"
      ? "text-emerald-400"
      : moodLabel === "neutral"
      ? "text-yellow-400"
      : "text-rose-400";

  return (
    <div className="w-80 h-full bg-white/30 backdrop-blur-xl rounded-3xl border border-white/20 p-5 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
            Aura
          </h2>
          <p className="text-xs text-gray-500">intelligent companion</p>
        </div>
      </div>

      {/* Mood card */}
      <div className="mb-5 p-4 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/20 shadow-inner">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-rose-400" />
            <span className="text-sm font-medium text-gray-700">conversation</span>
          </div>
          <div className={`text-lg font-bold ${moodColor}`}>
            {moodScore}% <span className="text-xs text-gray-400">positive</span>
          </div>
        </div>
        <div className="mt-2 h-1.5 w-full bg-gray-200/30 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              moodLabel === "positive"
                ? "bg-gradient-to-r from-emerald-400 to-green-500"
                : moodLabel === "neutral"
                ? "bg-gradient-to-r from-yellow-400 to-amber-500"
                : "bg-gradient-to-r from-rose-400 to-red-500"
            }`}
            style={{ width: `${moodScore}%` }}
          />
        </div>
      </div>

      {/* Smart Replies */}
      {roomSuggestions?.replies && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <MessageCircle className="h-4 w-4 text-blue-400" />
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Smart Replies</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {roomSuggestions.replies.map((reply, idx) => (
              <button
                key={idx}
                onClick={() => setInputMessage(reply)}
                className="px-3 py-1.5 bg-white/40 backdrop-blur-sm border border-white/30 text-purple-700 text-xs rounded-full hover:bg-white/60 transition"
              >
                {reply}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Activity Suggestions */}
      {roomSuggestions?.suggestions && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-indigo-400" />
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Suggestions</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {roomSuggestions.suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => setInputMessage(suggestion)}
                className="px-3 py-1.5 bg-white/40 backdrop-blur-sm border border-white/30 text-indigo-700 text-xs rounded-full hover:bg-white/60 transition"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Summary section (pushes to bottom) */}
      <div className="mt-auto pt-4 border-t border-white/20">
        {!roomChatSummary ? (
          <button
            onClick={requestSummary}
            disabled={loadingSummary}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-2.5 rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
          >
            {loadingSummary ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Generating...</span>
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                <span>Summarize Chat</span>
              </>
            )}
          </button>
        ) : (
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition" />
            <div className="relative p-4 bg-white/40 backdrop-blur-sm border border-white/30 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-purple-500" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Summary</p>
                </div>
                <button onClick={clearSummary} className="p-1 rounded-full hover:bg-white/40 transition">
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{roomChatSummary.summary}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}