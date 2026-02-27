import './i18n';
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";
import { ChatProvider } from "./context/ChatContext";
import { ContactsProvider } from "./context/ContactContext";
import { LanguageProvider } from "./context/LanguageContext";
import { ThemeProvider } from './context/ThemeContext';
ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <AuthProvider>
      <ChatProvider>
        <ContactsProvider>
          <LanguageProvider>
            <ThemeProvider>
              <App />
            </ThemeProvider>
          </LanguageProvider>
        </ContactsProvider>
      </ChatProvider>
    </AuthProvider>
  </BrowserRouter>
);
