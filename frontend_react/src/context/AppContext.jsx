import React, { createContext, useContext, useMemo, useState } from "react";
import { avatarFiles, translations } from "../shared/i18n";

// генерация случайного ID пользователя
const generateUserId = () => {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `id${num}`;
};

// глобальное состояние приложения (без бэк)
const AppContext = createContext(null);

export function AppProvider({ children }) {
  // ID текущего пользователя (генерируется один раз при загрузке)
  const [currentUserId] = useState(() => generateUserId());

  // язык интерфейса
  const [language, setLanguage] = useState("ru");

  // переключатели
  const [antiBullying, setAntiBullying] = useState(true);
  const [geoEnabled, setGeoEnabled] = useState(false);
  const [filterEnabled, setFilterEnabled] = useState(true);

  // вкладки и подменю
  const [activeTab, setActiveTab] = useState("chat"); // chat|stories
  const [chatMode, setChatMode] = useState("single-chat"); // single-chat|my-chats

  // страна
  const [selectedCountryIndex, setSelectedCountryIndex] = useState(null);

  // фильтры
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

  // история чатов (в оперативной памяти)
  const [chats, setChats] = useState([]);

  // последний активный чат (для экрана после завершения)
  const [lastChatId, setLastChatId] = useState(null);

  // лента историй (в оперативной памяти)
  const [stories, setStories] = useState([]);

  const dict = translations[language] || translations.ru;

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
  if (!ctx) throw new Error("useApp доожен быть внутри AppProvider");
  return ctx;
}
