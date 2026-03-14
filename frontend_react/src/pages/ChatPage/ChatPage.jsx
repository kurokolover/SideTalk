import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { countryFlags } from "../../shared/i18n";
import wsService from "../../api/websocket";

// чат-диалог: сообщения, ввод, автоответ, завершение
export default function ChatPage() {
  const nav = useNavigate();
  const { id } = useParams();
  const { dict, language, chats, setChats, setLastChatId, antiBullying } = useApp();
  const t = (key) => dict[key] || key;

  const chat = useMemo(() => chats.find((c) => c.id === id), [chats, id]);

  const [text, setText] = useState("");
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const listRef = useRef(null);

  // форматирование времени
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Message handler - defined outside useEffect to avoid recreation
  const handleChatMessage = useCallback((payload) => {
    console.log('ChatPage received message:', payload);

    // Accept messages for this chat OR messages without chatId (backward compatibility)
    if (payload.chatId && payload.chatId !== id) {
      console.log('Message for different chat, ignoring');
      return;
    }

    const newMessage = {
      id: payload.messageId || `msg-${Date.now()}`,
      from: payload.fromMe ? "me" : "them",
      textRu: payload.text,
      textEn: payload.text,
      ts: payload.timestamp || Date.now(),
    };

    console.log('Adding message to chat:', newMessage);

    setChats((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, messages: [...c.messages, newMessage] }
          : c
      )
    );
  }, [id, setChats]);

  // Peer disconnected handler
  const handlePeerDisconnected = useCallback((payload) => {
    console.log('Peer disconnected:', payload);
    // Mark chat as ended
    setChats((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, ended: true, endedAt: Date.now() } : c
      )
    );
  }, [id, setChats]);

  // Connection status handlers
  const handleConnected = useCallback(() => {
    console.log('WebSocket connected in ChatPage');
    setConnectionStatus('connected');
  }, []);

  const handleDisconnected = useCallback(() => {
    console.log('WebSocket disconnected in ChatPage');
    setConnectionStatus('disconnected');
  }, []);

  useEffect(() => {
    // если чат не найден — вернём на главную
    if (!chat) {
      nav("/");
      return;
    }

    // Check initial connection status
    if (wsService.isConnected()) {
      setConnectionStatus('connected');
    } else {
      setConnectionStatus('disconnected');
      // Try to reconnect
      wsService.ensureConnected().then(connected => {
        setConnectionStatus(connected ? 'connected' : 'disconnected');
      });
    }

    // Set up WebSocket listeners for this chat (always set up, even if chat ended - for sync)
    console.log('Setting up WebSocket listeners for chat:', id);

    wsService.on('chat_message', handleChatMessage);
    wsService.on('peer_disconnected', handlePeerDisconnected);
    wsService.on('connected', handleConnected);
    wsService.on('disconnected', handleDisconnected);

    // Cleanup listeners on unmount
    return () => {
      console.log('Cleaning up WebSocket listeners for chat:', id);
      wsService.off('chat_message', handleChatMessage);
      wsService.off('peer_disconnected', handlePeerDisconnected);
      wsService.off('connected', handleConnected);
      wsService.off('disconnected', handleDisconnected);
    };
  }, [chat, nav, id, handleChatMessage, handlePeerDisconnected, handleConnected, handleDisconnected]);

  useEffect(() => {
    // авто-скролл вниз
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [chat?.messages?.length]);

  const updateChatMessages = (newMessages) => {
    setChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, messages: newMessages } : c))
    );
  };

  const send = async () => {
    const value = text.trim();
    if (!value || !chat || chat.ended) return;

    // Check WebSocket connection before sending
    if (!wsService.isConnected()) {
      console.error('Cannot send message: WebSocket not connected');
      setConnectionStatus('disconnected');

      // Try to reconnect
      const reconnected = await wsService.ensureConnected();
      if (!reconnected) {
        alert(t("connection_error") || "Connection lost. Please refresh the page.");
        return;
      }
      setConnectionStatus('connected');
    }

    const timestamp = Date.now();
    const messageId = `m-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;

    // Add message to local state immediately (optimistic update)
    const msg = {
      id: messageId,
      from: "me",
      textRu: value,
      textEn: value,
      ts: timestamp,
    };

    const next = [...chat.messages, msg];
    updateChatMessages(next);
    setText("");

    // Send message via WebSocket
    console.log('Sending message via WebSocket:', { messageId, chatId: id, text: value });
    const sent = wsService.sendMessage({
      messageId,
      chatId: id,
      text: value,
      timestamp,
      fromMe: true,
    });

    if (!sent) {
      console.warn('Failed to send message via WebSocket');
      // Message is already in local state, user can see it
      // In a production app, you might want to mark it as "pending" or "failed"
    }
  };

  const handleFinishChat = async () => {
    if (!chat) return;

    console.log('Finishing chat:', id);

    // Notify server about ending chat
    if (wsService.isConnected()) {
      wsService.endChat();
      console.log('End chat notification sent');
    } else {
      console.warn('WebSocket not connected, trying to reconnect...');
      const reconnected = await wsService.ensureConnected();
      if (reconnected) {
        wsService.endChat();
        console.log('End chat notification sent after reconnect');
      } else {
        console.warn('Could not reconnect, end chat notification not sent');
      }
    }

    // Update local state
    setChats((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, ended: true, endedAt: Date.now() } : c
      )
    );
    setLastChatId(id);
    nav("/after");
  };

  const handleBack = () => {
    nav("/my-chats");
  };

  if (!chat) return null;

  useEffect(() => {
    if (chat && !chat.displayId) {
      // Если у чата нет displayId, добавляем его
      setChats(prev => prev.map(c => 
        c.id === id 
          ? { ...c, displayId: `id${Math.floor(100000 + Math.random() * 900000)}` }
          : c
      ));
    }
  }, [chat, id, setChats]);

  return (
    <div className="screen-full page-enter chat-page">
      {/* Connection status indicator */}
      {connectionStatus === 'disconnected' && !chat.ended && (
        <div className="chat-connection-warning">
          {t("connection_lost") || "Connection lost. Trying to reconnect..."}
        </div>
      )}

      {/* шапка чата */}
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

      {/* плашка анти-буллинг фильтра */}
      {antiBullying && (
        <div className="chat-antibullying-banner">
          {language === "ru" ? "включен антибуллинг-фильтр!" : "anti-bullying filter enabled!"}
        </div>
      )}

      {/* сообщения */}
      <div className="chat-messages" ref={listRef}>
        {chat.messages.map((m) => (
          <div
            key={m.id}
            className={
              "chat-bubble" + (m.from === "me" ? " chat-bubble--me" : "")
            }
          >
            <div className="chat-bubble__text">
              {language === "ru" ? m.textRu : m.textEn}
            </div>
            <div className="chat-bubble__time">
              {formatTime(m.ts)}
            </div>
          </div>
        ))}
      </div>

      {/* ввод или уведомление о завершении */}
      {chat.ended ? (
        <div className="chat-ended-notice">
          <span className="chat-ended-notice__text">
            {t("chat_ended")}
          </span>
        </div>
      ) : (
        <div className="chat-input">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
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
