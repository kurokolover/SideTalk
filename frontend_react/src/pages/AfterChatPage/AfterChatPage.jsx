import React from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";

// экран после завершения чата: 3 действия
export default function AfterChatPage() {
  const nav = useNavigate();
  const { dict } = useApp();
  const t = (k) => dict[k] || k;

  return (
    <div className="screen-full page-enter after-page">
      <div className="after-hero" aria-hidden="true">
        <div className="after-hero__circle" />
        <div className="after-hero__spark" />
      </div>

      <h2 className="after-title">{t("after_title")}</h2>
      <p className="after-sub">{t("after_sub")}</p>

      <div className="after-actions">
        <button className="after-btn after-btn--primary" onClick={() => nav("/")}>
          {t("after_go_home")}
        </button>
        <button className="after-btn" onClick={() => nav("/my-chats")}>
          {t("after_go_chats")}
        </button>
        <button className="after-btn" onClick={() => nav("/stories")}>
          {t("after_go_stories")}
        </button>
      </div>
    </div>
  );
}
