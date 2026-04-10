import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { avatarFiles, countryFlags } from "../shared/i18n";

// общий каркас приложения: верхняя панель + вкладки + модалки
export default function AppShell({ children }) {
  const nav = useNavigate();
  const location = useLocation();

  // какие экраны показывают общий верхний UI
  const pathname = location.pathname;
  const isChatRoute = pathname.startsWith("/chat/");
  const isAfterRoute = pathname.startsWith("/after");
  const isHomeRoute = pathname === "/";
  const isStoriesRoute = pathname.startsWith("/stories");
  const isMyChatsRoute = pathname.startsWith("/my-chats");
  const isImmersive = isChatRoute || isAfterRoute; // чат/после чата — без верхней панели и вкладок

  // язык можно менять только на главной и в ленте историй
  const showLanguage = isHomeRoute || isStoriesRoute;

  // выбор аватара только на главной странице
  const showAvatar = isHomeRoute;

  // панелька
  const showTabs = isHomeRoute || isStoriesRoute || isMyChatsRoute;

  const {
    language,
    setLanguage,
    dict,
    activeTab,
    setActiveTab,
    chatMode,
    setChatMode,
    selectedAvatarFile,
    setSelectedAvatarFile,
    geoEnabled,
    selectedCountryIndex,
    setSelectedCountryIndex,
  } = useApp();

  // модалки
  const [isAvatarModalOpen, setAvatarModalOpen] = useState(false);
  const [isCountryModalOpen, setCountryModalOpen] = useState(false);

  // выпадашка чата
  const [isChatSubmenuOpen, setChatSubmenuOpen] = useState(false);
  const tabSwitchRef = useRef(null);
  const chatSubmenuRef = useRef(null);

  const t = (key) => dict[key] || key;
  const countries = dict.countries || [];
  const chatTabLabel = isMyChatsRoute ? t("submenu_my_chats") : t("tab_chat");

  const currentAvatar =
    avatarFiles.find((a) => a.file === selectedAvatarFile) || avatarFiles[0];

  // подсветка вкладок по роуту
  useEffect(() => {
    if (isStoriesRoute) {
      setActiveTab("stories");
      return;
    }
    setActiveTab("chat");
  }, [isStoriesRoute, setActiveTab]);

  // закрытие подменю кликом вне
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!isChatSubmenuOpen) return;
      const tabsNode = tabSwitchRef.current;
      const menuNode = chatSubmenuRef.current;

      if (
        menuNode &&
        !menuNode.contains(e.target) &&
        tabsNode &&
        !tabsNode.contains(e.target)
      ) {
        setChatSubmenuOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isChatSubmenuOpen]);

  // открыть модалку стран по кастомному событию со страницы
  useEffect(() => {
    const open = () => {
      if (!geoEnabled) return;
      setCountryModalOpen(true);
    };
    window.addEventListener("sidetalk:open-country", open);
    return () => window.removeEventListener("sidetalk:open-country", open);
  }, [geoEnabled]);

  // закрытие модалок по Esc
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setAvatarModalOpen(false);
        setCountryModalOpen(false);
        setChatSubmenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleTabClick = (tab) => {
    if (tab === "chat") {
      setChatSubmenuOpen((prev) => !prev);
      return;
    }
    setChatSubmenuOpen(false);
    nav("/stories");
  };

  const handleChatModeClick = (mode) => {
    setChatMode(mode);
    setChatSubmenuOpen(false);
    if (mode === "my-chats") nav("/my-chats");
    else nav("/");
  };

  const handleCountrySelect = (index) => {
    setSelectedCountryIndex(index);
    setCountryModalOpen(false);
  };

  return (
    <div className="chat-app">
      {/* верхняя панель (только где нужно) */}
      {!isImmersive && (showAvatar || showLanguage) && (
        <header className="top-bar">
          {/* аватар слева */}
          {showAvatar && (
            <div className="top-left">
              <button
                className="avatar-button"
                aria-label={language === "ru" ? "Выбрать аватар" : "Choose avatar"}
                onClick={() => setAvatarModalOpen(true)}
              >
                <img
                  src={currentAvatar.file}
                  alt={language === "ru" ? currentAvatar.altRu : currentAvatar.altEn}
                  className="avatar-current"
                />
              </button>
            </div>
          )}

          {/* язык справа */}
          {showLanguage && (
            <div className="top-right">
              <div className="lang-switch" aria-label="Language switch">
                <button
                  className={
                    "lang-option" +
                    (language === "ru" ? " lang-option--active" : "")
                  }
                  onClick={() => setLanguage("ru")}
                >
                  RU
                </button>
                <button
                  className={
                    "lang-option" +
                    (language === "en" ? " lang-option--active" : "")
                  }
                  onClick={() => setLanguage("en")}
                >
                  EN
                </button>
              </div>
            </div>
          )}
        </header>
      )}

      {/* вкладки */}
      {!isImmersive && showTabs && (
        <div className="tabs-area">
          <div
            className={
              "tab-switch" +
              (activeTab === "stories" ? " tab-switch--stories" : "")
            }
            ref={tabSwitchRef}
          >
            <button
              className={
                "tab-btn" +
                (activeTab === "chat" ? " tab-btn--active" : "") +
                (isChatSubmenuOpen ? " tab-btn--dropdown-open" : "")
              }
              onClick={() => handleTabClick("chat")}
            >
              <span className="tab-label">{chatTabLabel}</span>
              <span className="tab-arrow" aria-hidden="true">
                ▾
              </span>
            </button>

            <button
              className={
                "tab-btn" + (activeTab === "stories" ? " tab-btn--active" : "")
              }
              onClick={() => handleTabClick("stories")}
            >
              <span className="tab-label">{t("tab_stories")}</span>
            </button>

            <div className="tab-indicator" />
          </div>

          {/* подменю чата (под вкладкой “чат”) */}
          <div
            className={
              "chat-submenu" +
              (isChatSubmenuOpen ? " chat-submenu--open" : "")
            }
            ref={chatSubmenuRef}
          >
            <button
              className="chat-submenu__item chat-submenu__item--top"
              onClick={() => handleChatModeClick("my-chats")}
            >
              {t("submenu_my_chats")}
            </button>
            <button
              className="chat-submenu__item chat-submenu__item--bottom"
              onClick={() => handleChatModeClick("single-chat")}
            >
              {t("submenu_chat")}
            </button>
          </div>
        </div>
      )}

      {/* содержимое (внутри карточки) */}
      <div className="page-viewport">{children}</div>

      {/* модалка аватара */}
      <div
        className={"modal" + (isAvatarModalOpen ? " modal--open" : "")}
        aria-hidden={isAvatarModalOpen ? "false" : "true"}
      >
        <div
          className="modal-backdrop"
          onClick={() => setAvatarModalOpen(false)}
        />
        <div className="modal-content">
          <h2 className="modal-title">{t("avatar_title")}</h2>
          <div className="avatar-grid">
            {avatarFiles.map((item) => (
              <button
                key={item.file}
                className={
                  "avatar-option" +
                  (item.file === selectedAvatarFile
                    ? " avatar-option--active"
                    : "")
                }
                onClick={() => {
                  setSelectedAvatarFile(item.file);
                  setAvatarModalOpen(false);
                }}
              >
                <img
                  src={item.file}
                  alt={language === "ru" ? item.altRu : item.altEn}
                />
              </button>
            ))}
          </div>
          <button className="modal-close" onClick={() => setAvatarModalOpen(false)}>
            {t("modal_done")}
          </button>
        </div>
      </div>

      {/* модалка страны */}
      <div
        className={"modal" + (isCountryModalOpen ? " modal--open" : "")}
        aria-hidden={isCountryModalOpen ? "false" : "true"}
      >
        <div
          className="modal-backdrop"
          onClick={() => setCountryModalOpen(false)}
        />
        <div className="modal-content">
          <h2 className="modal-title">{t("country_title")}</h2>
          <div className="country-list">
            {countries.map((name, index) => (
              <button
                key={name}
                type="button"
                className={
                  "country-option" +
                  (index === selectedCountryIndex ? " country-option--active" : "")
                }
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCountrySelect(index);
                }}
              >
                {countryFlags[name] && (
                  <img 
                    src={countryFlags[name]} 
                    alt=""
                    className="country-flag"
                  />
                )}
                <span>{name}</span>
              </button>
            ))}
          </div>
          <button 
            type="button"
            className="modal-close" 
            onClick={() => setCountryModalOpen(false)}
          >
            {t("modal_done")}
          </button>
        </div>
      </div>
    </div>
  );
}
