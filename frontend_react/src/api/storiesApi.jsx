import { BACKEND_URL, API_ENDPOINTS } from './config';

/**
 * fetch all
 * @returns {Promise<Array>} array of history objects
 */
export async function getHistories() {
  const response = await fetch(`${BACKEND_URL}${API_ENDPOINTS.GET_HISTORIES}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch histories: ${response.status}`);
  }

  const result = await response.json();
  return result.data || [];
}

/**
 * Addnewstory
 * @param {string} id - id history
 * @param {string} authorId - ID author
 * @param {string} text - history
 * @returns {Promise<void>}
 */
export async function addHistory(id, authorId, text) {
  const response = await fetch(`${BACKEND_URL}${API_ENDPOINTS.ADD_HISTORY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id, author_id: authorId, text }),
  });

  if (!response.ok) {
    throw new Error(`Failed to add history: ${response.status}`);
  }
}

/**
 * Acomment
 * @param {string} historyId - ID history
 * @param {string} id - id comment
 * @param {string} authorId - ID author
 * @param {string} text - comment
 * @returns {Promise<void>}
 */
export async function addComment(historyId, id, authorId, text) {
  const response = await fetch(`${BACKEND_URL}${API_ENDPOINTS.ADD_COMMENT}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ history_id: historyId, id, author_id: authorId, text }),
  });

  if (!response.ok) {
    throw new Error(`Failed to add comment: ${response.status}`);
  }
}

/**
 * like
 * @param {string} id - ID history
 * @returns {Promise<void>}
 */
export async function addLike(id) {
  const response = await fetch(`${BACKEND_URL}${API_ENDPOINTS.ADD_LIKE}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id }),
  });

  if (!response.ok) {
    throw new Error(`Failed to add like: ${response.status}`);
  }
}
