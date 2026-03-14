import React from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { countryFlags } from "../../shared/i18n";

// список завершённых/созданных чатов
export default function MyChatsPage() {
  const nav = useNavigate();
  const { dict, language, chats } = useApp();
  const t = (k) => dict[k] || k;

  return (
    <main className="content-card page-enter mychats-page">
      <h2 className="mychats-title">{t("submenu_my_chats")}</h2>

      {chats.length === 0 ? (
        <div className="empty-state">
          <p className="empty-text">{t("mychats_empty")}</p>
        </div>
      ) : (
        <div className="mychats-list">
          {chats.map((c) => {
            const last = c.messages && c.messages.length > 0
              ? c.messages[c.messages.length - 1]
              : null;
            const lastText = last
              ? (language === "ru" ? last.textRu : last.textEn)
              : t("mychats_no_messages");
            return (
              <button
                key={c.id}
                className="mychats-item"
                onClick={() => nav(`/chat/${c.id}`)}
              >
                <div className="mychats-item__avatar">
                  <img src={c.peerAvatar} alt="peer" />
                </div>
                <div className="mychats-item__body">
                  <div className="mychats-item__title">
                    {c.peerCountry && countryFlags[c.peerCountry] && (
                      <img
                        src={countryFlags[c.peerCountry]}
                        alt=""
                        className="mychats-item__flag"
                      />
                    )}
                    <span>{c.displayId || t("chat_title")}</span>
                  </div>
                  <div className={`mychats-item__preview${!last ? ' mychats-item__preview--empty' : ''}`}>
                    {lastText}
                  </div>
                  {c.ended && (
                    <div className="mychats-item__status">{t("chat_ended")}</div>
                  )}
                </div>
                <div className="mychats-item__arrow">→</div>
              </button>
            );
          })}
        </div>
      )}
    </main>
  );
}
