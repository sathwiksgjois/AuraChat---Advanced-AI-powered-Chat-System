import { useState } from "react";
import Sidebar from "../components/layout/Sidebar";
import ChatWindow from "../components/layout/ChatWindow";
import AiPanel from "../components/layout/AiPanel";
import Background from "../components/ui/Background";
import { Menu, X } from "lucide-react";
import { LanguageProvider } from "../context/LanguageContext";
import { ChatActionsProvider } from "../context/ChatActionsContext";

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  return (
    <LanguageProvider>
      <ChatActionsProvider>
        {/* Desktop flex layout (hidden on mobile, visible on md+) */}
        <div className="hidden md:flex h-screen p-4 gap-4 relative z-10">
          <Sidebar />
          <ChatWindow />
          <AiPanel />
        </div>

        {/* Mobile sliding panels (visible only on mobile) */}
        <div className="md:hidden relative h-screen overflow-hidden">
          <Background />

          {/* Mobile header buttons */}
          <div className="absolute top-4 left-4 z-20 flex gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 bg-white/30 backdrop-blur-xl rounded-full shadow-lg hover:bg-white/40 transition-all duration-300 hover:scale-110"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5 text-gray-700" />
            </button>
            <button
              onClick={() => setAiPanelOpen(true)}
              className="p-2 bg-white/30 backdrop-blur-xl rounded-full shadow-lg hover:bg-white/40 transition-all duration-300 hover:scale-110"
              aria-label="Open AI panel"
            >
              <Menu className="h-5 w-5 text-gray-700 rotate-90" />
            </button>
          </div>

          {/* Sidebar - slides in from left */}
          <div
            className={`
              fixed top-0 left-0 h-full z-30 transition-all duration-500 ease-in-out transform
              ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
            `}
          >
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>

          {/* Chat window - full screen on mobile */}
          <div className="absolute inset-0">
            <ChatWindow />
          </div>

          {/* AI Panel - slides in from right */}
          <div
            className={`
              fixed top-0 right-0 h-full z-30 transition-all duration-500 ease-in-out transform
              ${aiPanelOpen ? "translate-x-0" : "translate-x-full"}
            `}
          >
            <AiPanel onClose={() => setAiPanelOpen(false)} />
          </div>

          {/* Overlay when sidebars are open */}
          {(sidebarOpen || aiPanelOpen) && (
            <div
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-20 animate-fadeIn"
              onClick={() => {
                setSidebarOpen(false);
                setAiPanelOpen(false);
              }}
            />
          )}
        </div>
      </ChatActionsProvider>
    </LanguageProvider>
  );
}