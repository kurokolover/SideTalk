// API base URL:
// - empty string => same-origin requests via nginx/docker proxy
// - VITE_API_BASE_URL => external backend for deployments without same-origin proxy
export const BACKEND_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

// API endpoints
export const API_ENDPOINTS = {
  ADD_HISTORY: '/api/v1/add_history',
  ADD_COMMENT: '/api/v1/add_comment',
  GET_HISTORIES: '/api/v1/get_histories',
  ADD_LIKE: '/api/v1/add_like',
  REMOVE_LIKE: '/api/v1/remove_like',
};
