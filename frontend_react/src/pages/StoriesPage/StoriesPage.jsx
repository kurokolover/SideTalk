import React, { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../../context/AppContext";
import { getHistories, addHistory, addComment as apiAddComment, addLike, removeLike } from "../../api/storiesApi.jsx";
import { saveLikedStory, removeLikedStory, isStoryLiked } from "../../utils/localStorage";

const STORY_REFRESH_INTERVAL_MS = 15000;

const mergeStoryComments = (existingComments = [], fetchedComments = []) => {
  const merged = new Map();

  existingComments.forEach((comment) => {
    merged.set(comment.id, comment);
  });

  fetchedComments.forEach((comment) => {
    merged.set(comment.id, {
      ...(merged.get(comment.id) || {}),
      ...comment,
    });
  });

  return Array.from(merged.values());
};

const formatStoryFromApi = (item, existingStory = null) => {
  const fetchedComments = (item.comments || []).map((comment) => ({
    id: comment.id,
    authorId: comment.author_id || comment.id,
    textRu: comment.text,
    textEn: comment.text,
  }));

  return {
    id: item.id,
    authorId: item.author_id || item.id,
    textRu: item.text,
    textEn: item.text,
    createdAt: item.time ? new Date(item.time).getTime() : existingStory?.createdAt || Date.now(),
    liked: isStoryLiked(item.id),
    likes: typeof item.likes === "number" ? item.likes : existingStory?.likes || 0,
    comments: mergeStoryComments(existingStory?.comments || [], fetchedComments),
  };
};

const mergeStoriesWithServerData = (existingStories, fetchedStories) => {
  const existingById = new Map(existingStories.map((story) => [story.id, story]));
  const mergedFetchedStories = fetchedStories.map((item) =>
    formatStoryFromApi(item, existingById.get(item.id))
  );
  const fetchedIds = new Set(mergedFetchedStories.map((story) => story.id));
  const localOnlyStories = existingStories.filter((story) => !fetchedIds.has(story.id));

  return [...localOnlyStories, ...mergedFetchedStories].sort(
    (left, right) => right.createdAt - left.createdAt
  );
};

// лента историй: публикация, лайк toggle, комментарии
export default function StoriesPage() {
  const { dict, language, stories, setStories, currentUserId } = useApp();
  const t = (k) => dict[k] || k;

  const [text, setText] = useState("");
  const [isComposeOpen, setComposeOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const refreshInFlightRef = useRef(false);
  const keyboardSyncFrameRef = useRef(0);
  const keyboardSyncTimeoutRef = useRef(null);

  const loadStories = useCallback(async ({ silent = false } = {}) => {
    if (refreshInFlightRef.current) {
      return;
    }

    try {
      refreshInFlightRef.current = true;
      if (!silent) {
        setIsLoading(true);
      }

      const data = await getHistories();
      setStories((prevStories) => mergeStoriesWithServerData(prevStories, data));
    } catch (error) {
      console.error("Failed to fetch stories:", error);
    } finally {
      refreshInFlightRef.current = false;
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [setStories]);

  useEffect(() => {
    loadStories();

    const refreshStories = () => {
      if (document.visibilityState === "visible") {
        loadStories({ silent: true });
      }
    };

    const intervalId = window.setInterval(refreshStories, STORY_REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refreshStories);
    document.addEventListener("visibilitychange", refreshStories);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshStories);
      document.removeEventListener("visibilitychange", refreshStories);
    };
  }, [loadStories]);

  useEffect(() => {
    const body = document.body;
    const root = document.documentElement;
    const viewport = window.visualViewport;

    const isStoriesField = (element) =>
      element instanceof HTMLElement &&
      !!element.closest(".stories-page") &&
      (element.tagName === "INPUT" || element.tagName === "TEXTAREA");

    const syncViewportState = () => {
      window.cancelAnimationFrame(keyboardSyncFrameRef.current);
      keyboardSyncFrameRef.current = window.requestAnimationFrame(() => {
        const viewportHeight = viewport?.height || window.innerHeight;
        const offsetTop = viewport?.offsetTop || 0;
        const viewportScale = viewport?.scale || 1;
        const keyboardInset = Math.max(0, window.innerHeight - viewportHeight - offsetTop);
        const activeField = document.activeElement;
        const fieldFocused = isStoriesField(activeField);
        const keyboardOpen = fieldFocused && viewportScale <= 1.01 && keyboardInset > 120;
        const keyboardShift = Math.min(keyboardInset, 72) * 0.38;

        body.classList.add("stories-route-lock");
        body.classList.toggle("stories-route-lock--input-focused", fieldFocused);
        body.classList.toggle("stories-route-lock--keyboard", keyboardOpen);
        root.style.setProperty("--stories-visual-height", `${viewportHeight}px`);
        root.style.setProperty("--stories-visual-offset-top", `${offsetTop}px`);
        root.style.setProperty("--stories-keyboard-inset", `${keyboardInset}px`);
        root.style.setProperty("--stories-keyboard-shift", `${keyboardShift}px`);
      });
    };

    const handleFocusIn = (event) => {
      if (!isStoriesField(event.target)) {
        return;
      }

      syncViewportState();
      window.clearTimeout(keyboardSyncTimeoutRef.current);
      keyboardSyncTimeoutRef.current = window.setTimeout(() => {
        syncViewportState();
        event.target.scrollIntoView({
          block: "center",
          behavior: "smooth",
        });
      }, 140);
    };

    const handleFocusOut = (event) => {
      if (!isStoriesField(event.target)) {
        return;
      }

      window.clearTimeout(keyboardSyncTimeoutRef.current);
      keyboardSyncTimeoutRef.current = window.setTimeout(syncViewportState, 120);
    };

    syncViewportState();
    viewport?.addEventListener("resize", syncViewportState);
    viewport?.addEventListener("scroll", syncViewportState);
    window.addEventListener("resize", syncViewportState);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);

    return () => {
      window.cancelAnimationFrame(keyboardSyncFrameRef.current);
      window.clearTimeout(keyboardSyncTimeoutRef.current);
      body.classList.remove("stories-route-lock");
      body.classList.remove("stories-route-lock--keyboard");
      body.classList.remove("stories-route-lock--input-focused");
      root.style.removeProperty("--stories-visual-height");
      root.style.removeProperty("--stories-visual-offset-top");
      root.style.removeProperty("--stories-keyboard-inset");
      root.style.removeProperty("--stories-keyboard-shift");
      viewport?.removeEventListener("resize", syncViewportState);
      viewport?.removeEventListener("scroll", syncViewportState);
      window.removeEventListener("resize", syncViewportState);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  const publish = async () => {
    const v = text.trim();
    if (!v) return;

    const storyId = `s-${Date.now()}`;

    try {
      setIsPublishing(true);
      setPublishError("");

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

      setStories((prevStories) => [newStory, ...prevStories.filter((story) => story.id !== storyId)]);
      setText("");
      setComposeOpen(false);
      loadStories({ silent: true });
    } catch (error) {
      console.error("Failed to publish story:", error);
      setPublishError(
        language === "ru"
          ? "Не удалось опубликовать историю. Проверь подключение к серверу."
          : "Failed to publish story. Check your server connection."
      );
    } finally {
      setIsPublishing(false);
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
        loadStories({ silent: true });
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
        loadStories({ silent: true });
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
      loadStories({ silent: true });
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
        {isLoading && stories.length === 0 ? (
          <div className="empty-state">
            {language === "ru" ? "загружаем истории..." : "loading stories..."}
          </div>
        ) : stories.length === 0 ? (
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
        onClick={() => {
          setComposeOpen(false);
          setPublishError("");
        }}
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
            {publishError && (
              <div className="story-compose__error">{publishError}</div>
            )}
            <button
              className="primary-btn"
              onClick={publish}
              disabled={isPublishing}
            >
              {isPublishing
                ? (language === "ru" ? "публикуем..." : "publishing...")
                : t("stories_publish")}
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
