import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { avatarFiles } from "../../shared/i18n";
import wsService from "../../api/websocket";
import { getUserId } from "../../api/userService";

// страница подбора собеседника: подключение к WebSocket и ожидание матча
export default function SearchingPage() {
  const nav = useNavigate();
  const {
    dict,
    language,
    antiBullying,
    geoEnabled,
    selectedCountryIndex,
    filterEnabled,
    filters,
    selectedAvatarFile,
    setChats,
    setLastChatId,
    currentUserId
  } = useApp();
  const t = (key) => dict[key] || key;

  const [seconds, setSeconds] = useState(0);
  const createdRef = useRef(false);
  const wsConnectedRef = useRef(false);
  const showFiltersHint = seconds >= 60;

  const peerAvatar = useMemo(() => {
    // для демо выбираем «следующий» аватар
    const idx = Math.max(0, avatarFiles.findIndex((a) => a.file === selectedAvatarFile));
    return avatarFiles[(idx + 3) % avatarFiles.length];
  }, [selectedAvatarFile]);

  // генерация рандомной страны для собеседника
  const peerCountry = useMemo(() => {
    const countries = dict.countries || [];
    if (countries.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * countries.length);
    return countries[randomIndex];
  }, [dict.countries]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (createdRef.current || wsConnectedRef.current) return;

    const initWebSocket = async () => {
      try {
        // Connect to WebSocket
        await wsService.connect();
        wsConnectedRef.current = true;

        // Set up event listeners
        wsService.on('match_found', handleMatchFound);
        wsService.on('error', handleError);
        wsService.on('connection_failed', handleConnectionFailed);

        // Get selected country name (string from array)
        const countries = dict.countries || [];
        const selectedCountryName = geoEnabled && selectedCountryIndex != null && selectedCountryIndex >= 0
          ? countries[selectedCountryIndex] || ""
          : "";

        // Send match request
        const matchRequest = {
          userId: currentUserId,
          language,
          antiBullying,
          geoEnabled,
          selectedCountry: selectedCountryName,
          filterEnabled,
          filters,
          avatar: selectedAvatarFile, // Include user's avatar
        };

        console.log('Sending match request:', matchRequest);
        wsService.requestMatch(matchRequest);
      } catch (error) {
        console.error('WebSocket connection error:', error);
      }
    };

    initWebSocket();

    // Cleanup on unmount
    return () => {
      wsService.off('match_found', handleMatchFound);
      wsService.off('error', handleError);
      wsService.off('connection_failed', handleConnectionFailed);
    };
  }, []);

  const handleMatchFound = (payload) => {
    if (createdRef.current) return;
    createdRef.current = true;

    const {
      chatId,
      peerId,
      peerCountry,
      peerAvatar: receivedPeerAvatar,
      antiBullying: chatAntiBullying,
    } = payload;

    // Use chatId from server as the chat session ID
    const finalChatId = chatId || `chat-${getUserId()}-${Date.now()}`;

    // Use actual peer ID from server for display, or generate a proper user ID format
    const peerName = peerId || `id${Math.floor(100000 + Math.random() * 900000)}`;

    // Create new chat in history
    const newChat = {
      id: finalChatId,
      peerId: peerId || `id${Math.floor(100000 + Math.random() * 900000)}`, // Use proper user ID format
      peerName: peerName,
      peerAvatar: receivedPeerAvatar || peerAvatar.file, // Use avatar from backend or fallback
      peerCountry: peerCountry || null,
      createdAt: Date.now(),
      ended: false,
      antiBullying: !!chatAntiBullying,
      messages: [],
    };

    setLastChatId(finalChatId);
    setChats((prev) => {
      const existingChat = prev.find((c) => c.id === finalChatId);

      if (existingChat) {
        return [
          {
            ...existingChat,
            ...newChat,
            messages: existingChat.messages || [],
            ended: false,
            endedAt: null,
          },
          ...prev.filter((c) => c.id !== finalChatId),
        ];
      }

      return [newChat, ...prev];
    });

    // Navigate to chat
    nav(`/chat/${finalChatId}`, { replace: true });
  };

  const handleError = (payload) => {
    if (payload?.message === 'No match found. Please try again.') {
      return;
    }
    console.error('WebSocket error:', payload);
  };

  const handleConnectionFailed = (payload) => {
    console.error('WebSocket connection failed:', payload);
  };

  const handleCancel = () => {
    wsService.disconnect();
    nav('/');
  };

  const formattedMinutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const formattedSeconds = String(seconds % 60).padStart(2, "0");

  return (
    <main className="content-card page-enter">
      <div className="searching">
        <h2 className="searching-title">{t("searching_title")}</h2>
        <p className="searching-sub">{t("searching_sub")}</p>

        <div className="searching-spinner" aria-hidden="true" />

        <p className="searching-timer">
          {formattedMinutes}:{formattedSeconds}
        </p>

        <button className="secondary-btn" onClick={handleCancel}>
          {t("searching_cancel")}
        </button>

        {showFiltersHint && (
          <p className="searching-filters-hint">
            <span className="searching-filters-hint__eye" aria-hidden="true">
              <img
                className="searching-filters-hint__eye-open"
                src="/icons/eye-light.svg"
                alt=""
              />
              <img
                className="searching-filters-hint__eye-closed"
                src="/icons/eye-closed-light.svg"
                alt=""
              />
            </span>
            <span>{t("searching_filters_hint")}</span>
          </p>
        )}
      </div>
    </main>
  );
}
