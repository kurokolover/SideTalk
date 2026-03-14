import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { avatarFiles, translations } from "../shared/i18n";
import { loadChats, saveChats } from "../utils/localStorage";
import userService from "../api/userService";

// глобальное состояние приложения
const AppContext = createContext(null);

export function AppProvider({ children }) {
  // ID текущего пользователя (из централизованного сервиса, сохраняется в localStorage)
  const [currentUserId] = useState(() => userService.getUserId());

  const [language, setLanguage] = useState("ru");

  // переключатели
  const [antiBullying, setAntiBullying] = useState(true);
  const [geoEnabled, setGeoEnabled] = useState(false);
  const [filterEnabled, setFilterEnabled] = useState(true);

  // вкладки и подменю
  const [activeTab, setActiveTab] = useState("chat"); // chat|stories
  const [chatMode, setChatMode] = useState("single-chat"); // single-chat|my-chats

  const [selectedCountryIndex, setSelectedCountryIndex] = useState(null);

  const [filters, setFilters] = useState({
    myAge: "any",
    myGender: "any",
    peerAge: "any",
    peerGender: "any",
  });

  // аватар
  const [selectedAvatarFile, setSelectedAvatarFile] = useState(
    avatarFiles[0].file
  );

  // функция для генерации displayId
  const generateDisplayId = () => {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    return `id${randomNum}`;
  };

  // история чатов (загружается из localStorage и добавляем displayId если его нет)
  const [chats, setChats] = useState(() => {
    // Load chats from localStorage on initialization
    const loadedChats = loadChats();
    
    // Добавляем displayId для старых чатов, у которых его нет
    const chatsWithDisplayId = loadedChats.map(chat => {
      if (!chat.displayId) {
        return {
          ...chat,
          displayId: generateDisplayId()
        };
      }
      return chat;
    });
    
    // Сохраняем обновленные чаты обратно в localStorage
    if (chatsWithDisplayId.length !== loadedChats.length) {
      saveChats(chatsWithDisplayId);
    }
    
    return chatsWithDisplayId;
  });

  // последний активный чат (для экрана после завершения)
  const [lastChatId, setLastChatId] = useState(null);

  // лента историй (в оперативной памяти)
  const [stories, setStories] = useState([]);

  const dict = translations[language] || translations.ru;

  // Save chats to localStorage whenever they change
  useEffect(() => {
    saveChats(chats);
  }, [chats]);

  // функция для создания нового чата
  const startChat = (peerData) => {
    const newChat = {
      id: `chat_${Date.now()}`,
      displayId: generateDisplayId(), // добавляем красивый ID для отображения
      peerId: peerData.id, // реальный ID собеседника (не показываем)
      peerName: peerData.name,
      peerAvatar: peerData.avatar,
      peerCountry: peerData.country,
      createdAt: Date.now(),
      messages: [],
      ended: false,
    };
    
    setChats(prev => [newChat, ...prev]);
    return newChat;
  };

  const value = useMemo(
    () => ({
      // user
      currentUserId,

      // i18n
      language,
      setLanguage,
      dict,

      // toggles
      antiBullying,
      setAntiBullying,
      geoEnabled,
      setGeoEnabled,
      filterEnabled,
      setFilterEnabled,

      // tabs
      activeTab,
      setActiveTab,
      chatMode,
      setChatMode,

      // country
      selectedCountryIndex,
      setSelectedCountryIndex,

      // filters
      filters,
      setFilters,

      // avatar
      selectedAvatarFile,
      setSelectedAvatarFile,

      // chats
      chats,
      setChats,
      lastChatId,
      setLastChatId,

      // stories
      stories,
      setStories,

      // functions
      startChat,
    }),
    [
      currentUserId,
      language,
      dict,
      antiBullying,
      geoEnabled,
      filterEnabled,
      activeTab,
      chatMode,
      selectedCountryIndex,
      filters,
      selectedAvatarFile,
      chats,
      lastChatId,
      stories,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp должен быть внутри AppProvider");
  return ctx;
}