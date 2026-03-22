const STORAGE_KEYS = {
  CHATS: 'sidetalk_chats',
  USER_ID: 'sidetalk_user_id',
  SETTINGS: 'sidetalk_settings',
  LIKED_STORIES: 'sidetalk_liked_stories',
};

const MAX_CHATS = 100;

const MAX_CHAT_AGE_DAYS = 30;

export const saveChats = (chats) => {
  try {
    const now = Date.now();
    const maxAge = MAX_CHAT_AGE_DAYS * 24 * 60 * 60 * 1000;

    const dedupedChats = chats.reduce((acc, chat) => {
      const existingIndex = acc.findIndex((c) => c.id === chat.id);

      if (existingIndex === -1) {
        acc.push(chat);
      } else {
        const existing = acc[existingIndex];

        acc[existingIndex] = {
          ...existing,
          ...chat,
          messages:
            chat.messages && chat.messages.length > 0
              ? chat.messages
              : existing.messages || [],
          ended: chat.ended ?? existing.ended ?? false,
        };
      }

      return acc;
    }, []);

    const validChats = dedupedChats
      .filter((chat) => {
        const chatAge = now - chat.createdAt;
        return chatAge < maxAge;
      })
      .slice(0, MAX_CHATS);

    localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(validChats));
    return true;
  } catch (error) {
    console.error('Error saving chats to localStorage:', error);
    return false;
  }
};

export const loadChats = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CHATS);
    if (!stored) {
      return [];
    }

    const chats = JSON.parse(stored);

    const now = Date.now();
    const maxAge = MAX_CHAT_AGE_DAYS * 24 * 60 * 60 * 1000;

    const validChats = chats.filter(chat => {
      const chatAge = now - chat.createdAt;
      return chatAge < maxAge;
    });

    if (validChats.length !== chats.length) {
      saveChats(validChats);
    }

    return validChats;
  } catch (error) {
    console.error('Error loading chats from localStorage:', error);
    return [];
  }
};

export const saveChat = (chat) => {
  try {
    const chats = loadChats();
    const existingIndex = chats.findIndex(c => c.id === chat.id);

    if (existingIndex >= 0) {
      chats[existingIndex] = chat;
    } else {
      chats.unshift(chat); // в начало добавление
    }

    return saveChats(chats);
  } catch (error) {
    console.error('Error saving chat:', error);
    return false;
  }
};

export const deleteChat = (chatId) => {
  try {
    const chats = loadChats();
    const filtered = chats.filter(c => c.id !== chatId);
    return saveChats(filtered);
  } catch (error) {
    console.error('Error deleting chat:', error);
    return false;
  }
};

export const clearAllChats = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.CHATS);
    return true;
  } catch (error) {
    console.error('Error clearing chats:', error);
    return false;
  }
};

export const saveSettings = (settings) => {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
};

export const loadSettings = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Error loading settings:', error);
    return null;
  }
};

export const getStorageInfo = () => {
  try {
    const chats = loadChats();
    const chatsSize = new Blob([JSON.stringify(chats)]).size;

    return {
      chatCount: chats.length,
      sizeInBytes: chatsSize,
      sizeInKB: (chatsSize / 1024).toFixed(2),
      maxChats: MAX_CHATS,
      maxAgeDays: MAX_CHAT_AGE_DAYS,
    };
  } catch (error) {
    console.error('Error getting storage info:', error);
    return null;
  }
};

export const saveLikedStory = (storyId) => {
  try {
    const liked = loadLikedStories();
    if (!liked.includes(storyId)) {
      liked.push(storyId);
      localStorage.setItem(STORAGE_KEYS.LIKED_STORIES, JSON.stringify(liked));
    }
    return true;
  } catch (error) {
    console.error('Error saving liked story:', error);
    return false;
  }
};

export const removeLikedStory = (storyId) => {
  try {
    const liked = loadLikedStories();
    const filtered = liked.filter(id => id !== storyId);
    localStorage.setItem(STORAGE_KEYS.LIKED_STORIES, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Error removing liked story:', error);
    return false;
  }
};

export const loadLikedStories = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.LIKED_STORIES);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading liked stories:', error);
    return [];
  }
};

export const isStoryLiked = (storyId) => {
  try {
    const liked = loadLikedStories();
    return liked.includes(storyId);
  } catch (error) {
    console.error('Error checking if story is liked:', error);
    return false;
  }
};

export default {
  saveChats,
  loadChats,
  saveChat,
  deleteChat,
  clearAllChats,
  saveSettings,
  loadSettings,
  getStorageInfo,
  saveLikedStory,
  removeLikedStory,
  loadLikedStories,
  isStoryLiked,
};
