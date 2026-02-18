import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { countryFlags } from "../../shared/i18n";

// чат-диалог: сообщения, ввод, автоответ, завершение
export default function ChatPage() {
  const nav = useNavigate();
  const { id } = useParams();
  const { dict, language, chats, setChats, setLastChatId, antiBullying } = useApp();
  const t = (key) => dict[key] || key;

  const chat = useMemo(() => chats.find((c) => c.id === id), [chats, id]);

  const [text, setText] = useState("");
  const listRef = useRef(null);

  // форматирование времени
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  useEffect(() => {
    // если чат не найден — вернём на главную
    if (!chat) nav("/");
  }, [chat, nav]);

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

  const send = () => {
    const value = text.trim();
    if (!value || !chat || chat.ended) return;

    const msg = {
      id: `m-${Date.now()}`,
      from: "me",
      textRu: value,
      textEn: value,
      ts: Date.now(),
    };

    const next = [...chat.messages, msg];
    updateChatMessages(next);
    setText("");

    // демо автоответ
    window.setTimeout(() => {
      const reply = {
        id: `r-${Date.now()}`,
        from: "them",
        textRu: "ага...",
        textEn: "yeah...",
        ts: Date.now(),
      };
      updateChatMessages([...next, reply]);
    }, 650);
  };

  const handleFinishChat = () => {
    if (!chat) return;
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

  return (
    <div className="screen-full page-enter chat-page">
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
              <span>{chat.peerId || chat.peerName || t("chat_title")}</span>
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
