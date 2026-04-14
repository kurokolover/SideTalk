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

    const keepChatAnchored = () => {
      if (document.activeElement?.tagName !== "INPUT") {
        return;
      }

      window.scrollTo(0, 0);
      if (listRef.current) {
        listRef.current.scrollTo({
          top: listRef.current.scrollHeight,
          behavior: "smooth",
        });
      }
    };

    const syncChatViewport = () => {
      const height = viewport?.height || window.innerHeight;
      const offsetTop = viewport?.offsetTop || 0;
      const keyboardInset = Math.max(0, window.innerHeight - height - offsetTop);
      const keyboardOpen = keyboardInset > 120;

      root.style.setProperty("--chat-visual-height", `${height}px`);
      root.style.setProperty("--chat-visual-offset-top", `${offsetTop}px`);
      root.style.setProperty("--chat-keyboard-inset", `${keyboardInset}px`);
      body.classList.toggle("chat-route-lock--keyboard", keyboardOpen);

      if (document.activeElement?.tagName === "INPUT") {
        cancelAnimationFrame(frameId);
        frameId = window.requestAnimationFrame(keepChatAnchored);
      }
    };

    body.classList.add("chat-route-lock");
    syncChatViewport();

    viewport?.addEventListener("resize", syncChatViewport);
    viewport?.addEventListener("scroll", syncChatViewport);
    window.addEventListener("resize", syncChatViewport);

    return () => {
      cancelAnimationFrame(frameId);
      body.classList.remove("chat-route-lock");
      body.classList.remove("chat-route-lock--keyboard");
      root.style.removeProperty("--chat-visual-height");
      root.style.removeProperty("--chat-visual-offset-top");
      root.style.removeProperty("--chat-keyboard-inset");
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
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => {
              window.setTimeout(() => {
                window.scrollTo(0, 0);
                if (listRef.current) {
                  listRef.current.scrollTo({
                    top: listRef.current.scrollHeight,
                    behavior: "smooth",
                  });
                }
              }, 140);
            }}
            placeholder={t("chat_placeholder")}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
          />
          <button className="chat-send" onClick={send}>
            ➤
          </button>
        </div>
      )}
    </div>
  );
}
