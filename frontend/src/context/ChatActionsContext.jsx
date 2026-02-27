import { createContext, useContext, useRef } from 'react';

const ChatActionsContext = createContext();

export const useChatActions = () => {
  const context = useContext(ChatActionsContext);
  if (!context) throw new Error('useChatActions must be used within ChatActionsProvider');
  return context;
};

export const ChatActionsProvider = ({ children }) => {
  const setInputMessageRef = useRef(null);
  
  const registerSetInputMessage = (fn) => {
    setInputMessageRef.current = fn;
  };

  const setInputMessage = (text) => {
    if (setInputMessageRef.current) setInputMessageRef.current(text);
  };

  return (
    <ChatActionsContext.Provider value={{ registerSetInputMessage, setInputMessage }}>
      {children}
    </ChatActionsContext.Provider>
  );
};