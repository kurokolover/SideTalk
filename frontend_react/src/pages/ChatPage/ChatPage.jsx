import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { countryFlags } from "../../shared/i18n";
import wsService from "../../api/websocket";
import { containsAbusiveLanguage } from "../../utils/antiBullying";

// чат-диалог: сообщения, ввод, завершение
export default function ChatPage() {
  const nav = useNavigate();
  const { id } = useParams();
  const { dict, language, chats, setChats, setLastChatId } = useApp();
  const t = (key) => dict[key] || key;

  const chat = useMemo(
    () => chats.find((c) => c.id === id && !c.ended) || chats.find((c) => c.id === id),
    [chats, id]
  );

  const [text, setText] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("checking");
  const [peerEndedModalOpen, setPeerEndedModalOpen] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const keyboardSettleTimeoutRef = useRef(null);
  const keyboardTransitionTimeoutRef = useRef(null);
  const keyboardBlurTimeoutRef = useRef(null);
  const lastKeyboardOpenRef = useRef(false);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const handleChatMessage = useCallback(
    (payload) => {
      console.log("ChatPage received message:", payload);

      if (payload.chatId && payload.chatId !== id) {
        console.log("Message for different chat, ignoring");
        return;
      }

      const newMessage = {
        id: payload.messageId || `msg-${Date.now()}`,
        from: payload.fromMe ? "me" : "them",
        textRu: payload.text,
        textEn: payload.text,
        ts: payload.timestamp || Date.now(),
      };

      setChats((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, messages: [...(c.messages || []), newMessage] }
            : c
        )
      );
    },
    [id, setChats]
  );

  const handlePeerDisconnected = useCallback(
    (payload) => {
      console.log("Peer disconnected:", payload);
    },
    []
  );

  const handlePeerChatEnded = useCallback(() => {
    setChats((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, ended: true, endedAt: Date.now() } : c
      )
    );

    setPeerEndedModalOpen(true);
    window.setTimeout(() => {
      setPeerEndedModalOpen(false);
    }, 3000);
  }, [id, setChats]);

  const handleConnected = useCallback(() => {
    console.log("WebSocket connected in ChatPage");
    setConnectionStatus("connected");
  }, []);

  const handleDisconnected = useCallback(() => {
    console.log("WebSocket disconnected in ChatPage");
    setConnectionStatus("disconnected");
  }, []);

  const handleMessageBlocked = useCallback(
    (payload) => {
      if (payload.chatId && payload.chatId !== id) {
        return;
      }

      setChats((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                messages: (c.messages || []).map((message) =>
                  message.id === payload.messageId
                    ? { ...message, blocked: true }
                    : message
                ),
              }
            : c
        )
      );
    },
    [id, setChats]
  );

  useEffect(() => {
    if (!chat) {
      nav("/");
      return;
    }

    if (wsService.isConnected()) {
      setConnectionStatus("connected");
    } else {
      setConnectionStatus("disconnected");
      wsService.ensureConnected().then((connected) => {
        setConnectionStatus(connected ? "connected" : "disconnected");
      });
    }

    wsService.on("chat_message", handleChatMessage);
    wsService.on("peer_disconnected", handlePeerDisconnected);
    wsService.on("peer_chat_ended", handlePeerChatEnded);
    wsService.on("message_blocked", handleMessageBlocked);
    wsService.on("connected", handleConnected);
    wsService.on("disconnected", handleDisconnected);

    return () => {
      wsService.off("chat_message", handleChatMessage);
      wsService.off("peer_disconnected", handlePeerDisconnected);
      wsService.off("peer_chat_ended", handlePeerChatEnded);
      wsService.off("message_blocked", handleMessageBlocked);
      wsService.off("connected", handleConnected);
      wsService.off("disconnected", handleDisconnected);
    };
  }, [
    chat,
    nav,
    handleChatMessage,
    handlePeerDisconnected,
    handlePeerChatEnded,
    handleMessageBlocked,
    handleConnected,
    handleDisconnected,
  ]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [chat?.messages?.length]);

  useEffect(() => {
    if (chat && !chat.displayId) {
      setChats((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, displayId: `id${Math.floor(100000 + Math.random() * 900000)}` }
            : c
        )
      );
    }
  }, [chat, id, setChats]);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const viewport = window.visualViewport;
    let frameId = 0;

    const enableKeyboardTransition = () => {
      body.classList.add("chat-route-lock--keyboard-transitioning");
      window.clearTimeout(keyboardTransitionTimeoutRef.current);
      keyboardTransitionTimeoutRef.current = window.setTimeout(() => {
        body.classList.remove("chat-route-lock--keyboard-transitioning");
      }, 280);
    };

    const pinChatToBottom = () => {
      if (document.activeElement?.tagName !== "INPUT") {
        return;
      }

      window.scrollTo(0, 0);
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    };

    const applyViewportState = () => {
      const height = viewport?.height || window.innerHeight;
      const offsetTop = viewport?.offsetTop || 0;
      const viewportScale = viewport?.scale || 1;
      const isZoomed = viewportScale > 1.01;
      const keyboardInset = Math.max(0, window.innerHeight - height - offsetTop);
      const keyboardOpen = !isZoomed && keyboardInset > 120;

      if (lastKeyboardOpenRef.current !== keyboardOpen) {
        enableKeyboardTransition();
        lastKeyboardOpenRef.current = keyboardOpen;
      }

      root.style.setProperty("--chat-visual-height", `${height}px`);
      root.style.setProperty("--chat-visual-offset-top", `${offsetTop}px`);
      root.style.setProperty("--chat-keyboard-inset", `${keyboardInset}px`);
      root.style.setProperty("--chat-viewport-scale", `${viewportScale}`);
      body.classList.toggle("chat-route-lock--keyboard", keyboardOpen);
      body.classList.toggle("chat-route-lock--zoomed", isZoomed);

      if (!isZoomed && document.activeElement?.tagName === "INPUT") {
        pinChatToBottom();
      }
    };

    const syncChatViewport = () => {
      cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(applyViewportState);
    };

    body.classList.add("chat-route-lock");
    syncChatViewport();

    viewport?.addEventListener("resize", syncChatViewport);
    viewport?.addEventListener("scroll", syncChatViewport);
    window.addEventListener("resize", syncChatViewport);

    return () => {
      cancelAnimationFrame(frameId);
      window.clearTimeout(keyboardSettleTimeoutRef.current);
      window.clearTimeout(keyboardTransitionTimeoutRef.current);
      window.clearTimeout(keyboardBlurTimeoutRef.current);
      body.classList.remove("chat-route-lock");
      body.classList.remove("chat-route-lock--keyboard");
      body.classList.remove("chat-route-lock--input-focused");
      body.classList.remove("chat-route-lock--keyboard-transitioning");
      body.classList.remove("chat-route-lock--zoomed");
      root.style.removeProperty("--chat-visual-height");
      root.style.removeProperty("--chat-visual-offset-top");
      root.style.removeProperty("--chat-keyboard-inset");
      root.style.removeProperty("--chat-viewport-scale");
      viewport?.removeEventListener("resize", syncChatViewport);
      viewport?.removeEventListener("scroll", syncChatViewport);
      window.removeEventListener("resize", syncChatViewport);
    };
  }, []);

  const updateChatMessages = (newMessages) => {
    setChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, messages: newMessages } : c))
    );
  };

  const keepComposerAnchored = useCallback((smooth = false) => {
    window.scrollTo(0, 0);

    if (listRef.current) {
      if (smooth) {
        listRef.current.scrollTo({
          top: listRef.current.scrollHeight,
          behavior: "smooth",
        });
      } else {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }
  }, []);

  const handleInputFocus = useCallback(() => {
    document.body.classList.add("chat-route-lock--input-focused");
    document.body.classList.add("chat-route-lock--keyboard-transitioning");
    window.clearTimeout(keyboardBlurTimeoutRef.current);
    window.clearTimeout(keyboardTransitionTimeoutRef.current);
    window.clearTimeout(keyboardSettleTimeoutRef.current);

    window.setTimeout(() => {
      keepComposerAnchored(false);
    }, 50);

    keyboardSettleTimeoutRef.current = window.setTimeout(() => {
      keepComposerAnchored(true);
    }, 90);

    keyboardTransitionTimeoutRef.current = window.setTimeout(() => {
      document.body.classList.remove("chat-route-lock--keyboard-transitioning");
    }, 280);
  }, [keepComposerAnchored]);

  const handleInputBlur = useCallback(() => {
    window.clearTimeout(keyboardSettleTimeoutRef.current);
    window.clearTimeout(keyboardBlurTimeoutRef.current);

    keyboardBlurTimeoutRef.current = window.setTimeout(() => {
      if (document.activeElement === inputRef.current) {
        return;
      }

      document.body.classList.add("chat-route-lock--keyboard-transitioning");
      document.body.classList.remove("chat-route-lock--input-focused");

      window.clearTimeout(keyboardTransitionTimeoutRef.current);
      keyboardTransitionTimeoutRef.current = window.setTimeout(() => {
        document.body.classList.remove("chat-route-lock--keyboard-transitioning");
      }, 280);
    }, 140);
  }, []);

  const send = async () => {
    const value = text.trim();
    if (!value || !chat || chat.ended) return;

    const timestamp = Date.now();
    const messageId = `m-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
    const isBlockedByFilter = chat.antiBullying && containsAbusiveLanguage(value);

    const msg = {
      id: messageId,
      from: "me",
      textRu: value,
      textEn: value,
      ts: timestamp,
      blocked: isBlockedByFilter,
    };

    const next = [...(chat.messages || []), msg];
    updateChatMessages(next);
    setText("");

    if (isBlockedByFilter) {
      return;
    }

    if (!wsService.isConnected()) {
      console.error("Cannot send message: WebSocket not connected");
      setConnectionStatus("disconnected");

      const reconnected = await wsService.ensureConnected();
      if (!reconnected) {
        alert(t("connection_error") || "Connection lost. Please refresh the page.");
        return;
      }
      setConnectionStatus("connected");
    }

    const sent = wsService.sendMessage({
      messageId,
      chatId: id,
      text: value,
      timestamp,
      fromMe: true,
    });

    if (!sent) {
      console.warn("Failed to send message via WebSocket");
    }
  };

  const handleFinishChat = async () => {
    if (!chat) return;

    if (wsService.isConnected()) {
      wsService.endChat(id);
    } else {
      const reconnected = await wsService.ensureConnected();
      if (reconnected) {
        wsService.endChat(id);
      }
    }

    setChats((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, ended: true, endedAt: Date.now() } : c
      )
    );
    setLastChatId(id);
    nav("/after");
  };

  const handleBack = () => {
    nav("/");
  };

  if (!chat) return null;

  return (
    <div className="screen-full page-enter chat-page">
      {peerEndedModalOpen && (
        <div className="chat-ended-modal">
          <div className="chat-ended-modal__backdrop" />
          <div className="chat-ended-modal__content">
            {language === "ru"
              ? "Собеседник завершил чат"
              : "Your chat partner ended the chat"}
          </div>
        </div>
      )}

      {connectionStatus === "disconnected" && !chat.ended && (
        <div className="chat-connection-warning">
          {t("connection_lost") || "Connection lost. Trying to reconnect..."}
        </div>
      )}

      <div className="chat-header">
        <div className="chat-peer">
          <div className="chat-peer__avatar">
            <img src={chat.peerAvatar} alt="peer avatar" />
          </div>
          <div className="chat-peer__meta">
            <div className="chat-peer__name">
              {chat.peerCountry && countryFlags[chat.peerCountry] && (
                <img
                  src={countryFlags[chat.peerCountry]}
                  alt=""
                  className="chat-peer__flag"
                />
              )}
              <span>{chat.displayId || t("chat_title")}</span>
            </div>
            <div className={`chat-peer__status${chat.ended ? " chat-peer__status--ended" : ""}`}>
              {chat.ended ? t("chat_ended") : t("chat_online")}
            </div>
          </div>
        </div>

        {chat.ended ? (
          <button className="chat-back-btn" onClick={handleBack}>
            ← {t("back") || "назад"}
          </button>
        ) : (
          <button className="chat-finish" onClick={handleFinishChat}>
            {t("chat_finish")}
          </button>
        )}
      </div>

      {chat.antiBullying && (
        <div className="chat-antibullying-banner">
          {language === "ru"
            ? "включен антибуллинг-фильтр!"
            : "anti-bullying filter enabled!"}
        </div>
      )}

      <div className="chat-messages" ref={listRef}>
        {(chat.messages || []).map((m) => (
          <div
            key={m.id}
            className={
              "chat-bubble" +
              (m.from === "me" ? " chat-bubble--me" : "") +
              (m.blocked ? " chat-bubble--blocked" : "")
            }
          >
            <div className="chat-bubble__text">
              {m.textRu || m.textEn}
            </div>
            <div className="chat-bubble__footer">
              {m.from === "me" && m.blocked && (
                <div className="chat-bubble__status">
                  {t("chat_message_blocked")}
                </div>
              )}
              <div className="chat-bubble__time">{formatTime(m.ts)}</div>
            </div>
          </div>
        ))}
      </div>

      {chat.ended ? (
        <div className="chat-ended-notice">
          <span className="chat-ended-notice__text">{t("chat_ended")}</span>
        </div>
      ) : (
        <div className="chat-input">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder={t("chat_placeholder")}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
          />
          <button
            className="chat-send"
            onPointerDown={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
            onClick={async () => {
              await send();
              if (inputRef.current && window.matchMedia("(max-width: 768px)").matches) {
                inputRef.current.focus({ preventScroll: true });
                keepComposerAnchored(true);
              }
            }}
          >
            ➤
          </button>
        </div>
      )}
    </div>
  );
}
