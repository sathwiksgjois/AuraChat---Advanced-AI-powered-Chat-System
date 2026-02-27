import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from '../api/axios';
import { AuthContext } from './AuthContext';

const LanguageContext = createContext();

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const { i18n } = useTranslation();
  const [uiLanguage, setUiLanguage] = useState('en');
  const [messageTargetLang, setMessageTargetLang] = useState('en');
  // Structure: translationsByRoom[roomId][lang] = { messageId: translatedText }
  const [translationsByRoom, setTranslationsByRoom] = useState({});
  const [isTranslating, setIsTranslating] = useState(false);
  const currentRoomIdRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Sync with user preference
  useEffect(() => {
    if (user?.preferred_language) {
      setUiLanguage(user.preferred_language);
      setMessageTargetLang(user.preferred_language);
      i18n.changeLanguage(user.preferred_language);
    }
  }, [user, i18n]);

  const changeUiLanguage = useCallback(async (lang) => {
    try {
      await axios.put('/auth/update-language/', { language: lang });
      setUiLanguage(lang);
      i18n.changeLanguage(lang);
    } catch (err) {
      console.error('Failed to update UI language', err);
    }
  }, [i18n]);

  const changeMessageLanguage = useCallback((lang) => {
    setMessageTargetLang(lang);
    // DO NOT clear all translations – only the new language for the current room will be fetched when needed
  }, []);

  const setCurrentRoomId = useCallback((roomId) => {
    currentRoomIdRef.current = roomId;
  }, []);

  const translateBatch = useCallback(async (messages, roomId) => {
    console.log(`translateBatch called with ${messages.length} messages, targetLang: ${messageTargetLang}, roomId: ${roomId}`);
    if (!messages.length || messageTargetLang === 'en') {
      // English: no translation needed
      return;
    }

    // Check if we already have translations for this room and language
    const roomCache = translationsByRoom[roomId]?.[messageTargetLang];
    if (roomCache && Object.keys(roomCache).length === messages.length) {
      console.log(`Already have translations for room ${roomId} in ${messageTargetLang}`);
      return;
    }

    if (roomId !== currentRoomIdRef.current) {
      console.log('translateBatch: room changed, ignoring');
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    setIsTranslating(true);
    try {
      const response = await axios.post('/chat/translate-batch/', {
        message_ids: messages.map(m => m.id),
        target_lang: messageTargetLang
      }, { signal });

      if (roomId !== currentRoomIdRef.current) {
        console.log('translateBatch: room changed after request, ignoring result');
        return;
      }

      // Store under roomId and language
      setTranslationsByRoom(prev => ({
        ...prev,
        [roomId]: {
          ...(prev[roomId] || {}),
          [messageTargetLang]: response.data
        }
      }));
      console.log(`Translations stored for room ${roomId}, language ${messageTargetLang}`);
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        console.error('Batch translation failed', err);
      }
    } finally {
      setIsTranslating(false);
      abortControllerRef.current = null;
    }
  }, [messageTargetLang, translationsByRoom]); // ✅ added translationsByRoom to deps

  const getDisplayContent = useCallback((msg, roomId) => {
    if (roomId !== currentRoomIdRef.current) {
      return msg.content; // shouldn't happen
    }
    if (messageTargetLang === 'en') {
      return msg.content;
    }
    const roomLangCache = translationsByRoom[roomId]?.[messageTargetLang];
    if (roomLangCache && roomLangCache[String(msg.id)]) {
      return roomLangCache[String(msg.id)];
    }
    return msg.content;
  }, [messageTargetLang, translationsByRoom]);

  return (
    <LanguageContext.Provider value={{
      uiLanguage,
      messageTargetLang,
      changeUiLanguage,
      changeMessageLanguage,
      setCurrentRoomId,
      translateBatch,
      isTranslating,
      getDisplayContent,
    }}>
      {children}
    </LanguageContext.Provider>
  );
};