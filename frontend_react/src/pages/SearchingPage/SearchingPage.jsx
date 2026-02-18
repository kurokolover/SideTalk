import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { avatarFiles } from "../../shared/i18n";

// страница подбора собеседника: таймер 5 сек, затем создаём чат
export default function SearchingPage() {
  const nav = useNavigate();
  const { dict, selectedAvatarFile, setChats, setLastChatId } = useApp();
  const t = (key) => dict[key] || key;

  const [seconds, setSeconds] = useState(0);
  const createdRef = useRef(false);

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
    if (seconds < 5 || createdRef.current) return;
    createdRef.current = true;

    // создаём новый чат в истории
    const id = `chat-${Date.now()}`;
    const seedMessages = [
      {
        id: `m1-${id}`,
        from: "them",
        textRu: "прив кд чд",
        textEn: "hi lol",
        ts: Date.now(),
      },
      {
        id: `m2-${id}`,
        from: "me",
        textRu: "фу ты скучный",
        textEn: "ugh you're boring",
        ts: Date.now(),
      },
    ];

    setLastChatId(id);

    setChats((prev) => {
      const peerId = `id${String(303001 + prev.length).padStart(6, "0")}`;
      return [
        {
          id,
          peerId,
          peerName: peerId,
          peerAvatar: peerAvatar.file,
          peerCountry: peerCountry,
          createdAt: Date.now(),
          ended: false,
          messages: seedMessages,
        },
        ...prev,
      ];
    });

nav(`/chat/${id}`, { replace: true });
  }, [seconds, nav, setChats, peerAvatar.file]);

  return (
    <main className="content-card page-enter">
      <div className="searching">
        <h2 className="searching-title">{t("searching_title")}</h2>
        <p className="searching-sub">{t("searching_sub")}</p>

        <div className="searching-spinner" aria-hidden="true" />

        <p className="searching-timer">
          00:{String(Math.min(seconds, 5)).padStart(2, "0")}
        </p>

        <button className="secondary-btn" onClick={() => nav("/")}
        >
          {t("searching_cancel")}
        </button>
      </div>
    </main>
  );
}
