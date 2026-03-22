import React, { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { getHistories, addHistory, addComment as apiAddComment, addLike, removeLike } from "../../api/storiesApi.jsx";
import { saveLikedStory, removeLikedStory, isStoryLiked } from "../../utils/localStorage";

// лента историй: публикация, лайк toggle, комментарии
export default function StoriesPage() {
  const { dict, language, stories, setStories, currentUserId } = useApp();
  const t = (k) => dict[k] || k;

  const [text, setText] = useState("");
  const [isComposeOpen, setComposeOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Загрузка историй с бэкенда при монтировании компонента
  useEffect(() => {
    const fetchStories = async () => {
      try {
        setIsLoading(true);
        const data = await getHistories();
        // Преобразуем данные с бэкенда в формат фронтенда
        const formattedStories = data.map((item) => ({
          id: item.id,
          authorId: item.author_id || item.id,
          textRu: item.text,
          textEn: item.text,
          createdAt: item.time ? new Date(item.time).getTime() : Date.now(),
          liked: isStoryLiked(item.id), // Проверяем, лайкнута ли история в localStorage
          likes: item.likes || 0,
          comments: (item.comments || []).map((c) => ({
            id: c.id,
            authorId: c.author_id || c.id,
            textRu: c.text,
            textEn: c.text,
          })),
        }));
        setStories(formattedStories);
      } catch (error) {
        console.error("Failed to fetch stories:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStories();
  }, [setStories]);

  const publish = async () => {
    const v = text.trim();
    if (!v) return;

    const storyId = `s-${Date.now()}`;

    try {
      // Отправляем на бэкенд (authorId берётся автоматически из userService)
      await addHistory(storyId, v);

      // Добавляем локально для мгновенного отображения
      const newStory = {
        id: storyId,
        authorId: currentUserId,
        textRu: v,
        textEn: v,
        createdAt: Date.now(),
        liked: false,
        likes: 0,
        comments: [],
      };

      setStories([newStory, ...stories]);
      setText("");
    } catch (error) {
      console.error("Failed to publish story:", error);
    }
  };

  const toggleLike = async (id) => {
    const story = stories.find((s) => s.id === id);
    if (!story) return;

    // Если история уже лайкнута, убираем лайк
    if (story.liked) {
      try {
        await removeLike(id);
        // Удаляем лайк из localStorage
        removeLikedStory(id);

        // Обновляем локальное состояние
        setStories((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  liked: false,
                  likes: Math.max(0, s.likes - 1),
                }
              : s
          )
        );
      } catch (error) {
        console.error("Failed to remove like:", error);
      }
    } else {
      // Если история не лайкнута, добавляем лайк
      try {
        await addLike(id);
        // Сохраняем лайк в localStorage
        saveLikedStory(id);

        // Обновляем локальное состояние
        setStories((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  liked: true,
                  likes: s.likes + 1,
                }
              : s
          )
        );
      } catch (error) {
        console.error("Failed to add like:", error);
      }
    }
  };

  const addComment = async (id, value) => {
    const v = value.trim();
    if (!v) return;

    const commentId = `c-${Date.now()}`;

    try {
      // Отправляем комментарий на бэкенд (authorId берётся автоматически из userService)
      await apiAddComment(id, commentId, v);

      // Обновляем локальное состояние
      setStories((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                comments: [
                  ...s.comments,
                  { id: commentId, authorId: currentUserId, textRu: v, textEn: v },
                ],
              }
            : s
        )
      );
    } catch (error) {
      console.error("Failed to add comment:", error);
    }
  };

  const now = Date.now();

  return (
    <main className="content-card page-enter stories-page stories-page--layout">
      <h2 className="stories-title">{t("stories_title")}</h2>

      {/* список историй выше кнопки */}
      <div className="stories-scroll">
        {stories.length === 0 ? (
          <div className="empty-state">{t("stories_empty")}</div>
        ) : (
          stories.map((s) => (
            <StoryCard
              key={s.id}
              story={s}
              language={language}
              t={t}
              now={now}
              onToggleLike={() => toggleLike(s.id)}
              onAddComment={(value) => addComment(s.id, value)}
            />
          ))
        )}
      </div>

      {/* кнопка снизу */}
      <div className="stories-bottom">
        <button className="primary-btn" onClick={() => setComposeOpen(true)}>
          {t("stories_share")}
        </button>
      </div>

      {/* окно создания истории — только по нажатию */}
      <div
        className={"modal" + (isComposeOpen ? " modal--open" : "")}
        role="dialog"
        aria-modal="true"
        onClick={() => setComposeOpen(false)}
      >
        <div className="modal-backdrop" />
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <h3 className="modal-title">{t("stories_share")}</h3>

          <div className="story-compose">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("stories_placeholder")}
              rows={4}
            />
            <button
              className="primary-btn"
              onClick={() => {
                publish();
                setComposeOpen(false);
              }}
            >
              {t("stories_publish")}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function StoryCard({ story, language, t, now, onToggleLike, onAddComment }) {
  const [openComments, setOpenComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate time ago with proper rounding
  const getTimeAgo = () => {
    const minutesAgo = Math.round((now - story.createdAt) / 60000);
    const hoursAgo = Math.round((now - story.createdAt) / 3600000);
    const daysAgo = Math.round((now - story.createdAt) / 86400000);

    if (daysAgo >= 1) {
      return `${daysAgo}${t("time_days")}`;
    } else if (hoursAgo >= 1) {
      return `${hoursAgo}${t("time_hours")}`;
    } else {
      return `${Math.max(1, minutesAgo)}${t("time_minutes")}`;
    }
  };

  const timeAgo = getTimeAgo();

  const text = story.textRu || story.textEn;
  const authorDisplay = story.authorId || "id439449";

  // Check if text is long (more than ~80 chars or has multiple lines)
  const isLongText = text.length > 80 || text.split('\n').length > 2;

  return (
    <div className="story-card">
      <div className="story-meta">
        <span className="story-meta__badge">{authorDisplay}</span>
        <span className="story-meta__time">{timeAgo}</span>
      </div>

      <div className="story-text-wrapper">
        <div className={`story-text${!isExpanded && isLongText ? ' story-text--truncated' : ''}`}>
          {text}
        </div>
        {isLongText && (
          <button
            className={`story-expand${isExpanded ? ' story-expand--open' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            <span className="story-expand__arrow">▼</span>
          </button>
        )}
      </div>

      <div className="story-actions">
        <button
          className={"story-like" + (story.liked ? " story-like--active" : "")}
          onClick={(e) => {
            e.stopPropagation();
            onToggleLike();
          }}
        >
          ❤ {story.likes}
        </button>

        <button
          className="story-comment"
          onClick={(e) => {
            e.stopPropagation();
            setOpenComments((v) => !v);
          }}
        >
          {t("stories_comment")} ({story.comments.length})
        </button>
      </div>

      <div
        className={
          "story-comments" + (openComments ? " story-comments--open" : "")
        }
      >
        <div className="story-comments__list">
          {story.comments.map((c) => (
            <div key={c.id} className="story-comment-item">
              <span className="story-comment-item__name">{c.authorId || "id439449"}:</span>
              <span className="story-comment-item__text">
                {c.textRu || c.textEn}
              </span>
            </div>
          ))}
        </div>

        <div className="story-comments__input">
          <input
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="..."
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                onAddComment(commentText);
                setCommentText("");
              }
            }}
          />
          <button
            className="story-send"
            onClick={(e) => {
              e.stopPropagation();
              onAddComment(commentText);
              setCommentText("");
            }}
          >
            {t("stories_send_comment")}
          </button>
        </div>
      </div>
    </div>
  );
}
