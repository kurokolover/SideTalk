import { BACKEND_URL } from './config';
import userService from './userService';

const WS_SESSION_STORAGE_KEY = 'sidetalk_ws_session_id';

const generateWsSessionId = () => {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `ws-${Date.now()}-${randomPart}`;
};

const toWebSocketBaseUrl = (httpUrl) => {
  if (!httpUrl) {
    return '';
  }

  try {
    const parsed = new URL(httpUrl, window.location.origin);
    parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
    parsed.pathname = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch (error) {
    return '';
  }
};

class WebSocketService {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.isIntentionallyClosed = false;
    this.pendingMessages = [];
    this.connectionPromise = null;
    this.userId = null;
    this.wsSessionId = null;
    this.activeMatchRequest = null;
  }

  getUserId() {
    if (!this.userId) {
      this.userId = userService.getUserId();
    }
    return this.userId;
  }

  getWsSessionId() {
    if (this.wsSessionId) {
      return this.wsSessionId;
    }

    try {
      const storedId = sessionStorage.getItem(WS_SESSION_STORAGE_KEY);
      if (storedId) {
        this.wsSessionId = storedId;
      } else {
        this.wsSessionId = generateWsSessionId();
        sessionStorage.setItem(WS_SESSION_STORAGE_KEY, this.wsSessionId);
      }
    } catch (error) {
      this.wsSessionId = this.wsSessionId || generateWsSessionId();
    }

    return this.wsSessionId;
  }

  getWebSocketUrls() {
    const isHttpsPage = window.location.protocol === 'https:';
    const protocol = isHttpsPage ? 'wss:' : 'ws:';
    const currentPort = window.location.port || (isHttpsPage ? '443' : '80');
    const urls = [];
    const seen = new Set();

    const addUrl = (url) => {
      if (!url || seen.has(url)) {
        return;
      }
      seen.add(url);
      urls.push(url);
    };

    addUrl(`${protocol}//${window.location.host}/ws`);

    if (BACKEND_URL) {
      try {
        const backendUrl = new URL(BACKEND_URL, window.location.origin);
        const backendUsesHttps = backendUrl.protocol === 'https:';
        const backendIsSameOrigin = backendUrl.origin === window.location.origin;

        // On custom domains we should prefer same-origin `/ws`.
        // Cross-origin insecure ws:// fallbacks are blocked on https pages.
        if (!isHttpsPage || backendUsesHttps || backendIsSameOrigin) {
          addUrl(`${toWebSocketBaseUrl(BACKEND_URL)}/ws`);
        } else {
          console.warn('Skipping insecure BACKEND_URL WebSocket candidate on https page:', BACKEND_URL);
        }
      } catch (error) {
        console.warn('Failed to parse BACKEND_URL for WebSocket candidate:', BACKEND_URL, error);
      }
    }

    // Keep a direct backend fallback for plain http domains and local IP deployments.
    if (!isHttpsPage && currentPort !== '8080') {
      addUrl(`ws://${window.location.hostname}:8080/ws`);
    }

    return urls;
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return Promise.resolve();
    }

    if (this.connectionPromise) {
      console.log('WebSocket connection already in progress, waiting...');
      return this.connectionPromise;
    }

    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      console.log('WebSocket connection in progress...');
      this.connectionPromise = new Promise((resolve, reject) => {
        const checkConnection = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            clearInterval(checkConnection);
            this.connectionPromise = null;
            resolve();
          } else if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
            clearInterval(checkConnection);
            this.connectionPromise = null;
            reject(new Error('Connection failed'));
          }
        }, 100);

        setTimeout(() => {
          clearInterval(checkConnection);
          this.connectionPromise = null;
          reject(new Error('Connection timeout'));
        }, 10000);
      });
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      const wsUrls = this.getWebSocketUrls();
      let resolved = false;
      let attemptIndex = 0;

      const handleSocketOpen = () => {
        console.log('WebSocket connected successfully');
        this.reconnectAttempts = 0;
        this.connectionPromise = null;

        this.sendUserIdentification();

        if (this.activeMatchRequest && !this.hasPendingMessage('match_request')) {
          this.send('match_request', this.activeMatchRequest, true);
        }

        this.notifyListeners('connected', { userId: this.getUserId() });

        this.flushPendingMessages();

        resolved = true;
        resolve();
      };

      const attachSocketHandlers = (socket) => {
        this.ws = socket;
        this.isIntentionallyClosed = false;

        socket.onmessage = (event) => {
          try {
            const messages = String(event.data).split('\n').filter(m => m.trim());
            messages.forEach(msgStr => {
              try {
                const message = JSON.parse(msgStr);
                this.handleMessage(message);
              } catch (parseError) {
                console.error('Error parsing WebSocket message:', parseError, msgStr);
              }
            });
          } catch (error) {
            console.error('Error processing WebSocket message:', error);
          }
        };

        socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          if (!resolved) {
            return;
          }

          this.notifyListeners('error', { message: 'WebSocket connection error' });
        };

        socket.onclose = (event) => {
          console.log('WebSocket disconnected', event.code, event.reason);
          this.connectionPromise = null;
          this.notifyListeners('disconnected', { code: event.code, reason: event.reason });
          if (!this.isIntentionallyClosed) {
            this.attemptReconnect();
          }
        };
      };

      const tryConnect = () => {
        if (attemptIndex >= wsUrls.length) {
          this.connectionPromise = null;
          reject(new Error('WebSocket connection failed for all configured URLs'));
          return;
        }

        const wsUrl = wsUrls[attemptIndex++];

        try {
          console.log('Connecting to WebSocket:', wsUrl);
          const socket = new WebSocket(wsUrl);
          let opened = false;
          let advanced = false;

          const advanceToNextCandidate = () => {
            if (advanced || opened) {
              return;
            }
            advanced = true;
            tryConnect();
          };

          socket.onopen = () => {
            opened = true;
            attachSocketHandlers(socket);
            handleSocketOpen();
          };

          socket.onerror = (error) => {
            console.error('WebSocket candidate error:', wsUrl, error);
            advanceToNextCandidate();
          };

          socket.onclose = () => {
            advanceToNextCandidate();
          };
        } catch (error) {
          console.error('Failed to create WebSocket candidate:', wsUrl, error);
          tryConnect();
        }
      };

      try {
        tryConnect();
      } catch (error) {
        this.connectionPromise = null;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1), 30000);
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`);

      setTimeout(() => {
        this.connect().catch((error) => {
          console.error('Reconnection failed:', error);
        });
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      this.notifyListeners('connection_failed', { message: 'Failed to connect to server' });
    }
  }

  flushPendingMessages() {
    if (this.pendingMessages.length > 0) {
      console.log(`Flushing ${this.pendingMessages.length} pending messages`);
      const messages = [...this.pendingMessages];
      this.pendingMessages = [];

      messages.forEach(({ type, payload }) => {
        this.send(type, payload);
      });
    }
  }

  replacePendingMessage(type, payload) {
    this.pendingMessages = this.pendingMessages.filter(
      (message) => message.type !== type
    );
    this.pendingMessages.push({ type, payload });
  }

  hasPendingMessage(type) {
    return this.pendingMessages.some((message) => message.type === type);
  }

  handleMessage(message) {
    const { type, payload } = message;
    this.notifyListeners(type, payload);
  }

  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
  }

  off(eventType, callback) {
    if (this.listeners.has(eventType)) {
      const callbacks = this.listeners.get(eventType);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  notifyListeners(eventType, payload) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).forEach((callback) => {
        try {
          callback(payload);
        } catch (error) {
          console.error(`Error in listener for ${eventType}:`, error);
        }
      });
    }
  }

  send(type, payload, queueIfDisconnected = false) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = { type, payload };
      try {
        this.ws.send(JSON.stringify(message));
        console.log('WebSocket message sent:', type);
        return true;
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        if (queueIfDisconnected) {
          this.replacePendingMessage(type, payload);
        }
        return false;
      }
    } else {
      console.error('WebSocket is not connected, state:', this.getConnectionState());

      if (queueIfDisconnected) {
        console.log('Queueing message for later:', type);
        this.replacePendingMessage(type, payload);
      }

      if (!this.isIntentionallyClosed) {
        this.connect().catch(err => {
          console.error('Failed to reconnect:', err);
        });
      }
      return false;
    }
  }

  sendUserIdentification() {
    const userId = this.getWsSessionId();
    console.log('Sending user identification:', userId);
    this.send('user_identify', { userId });
  }

  requestMatch(matchRequest) {
    const requestWithUserId = {
      ...matchRequest,
      userId: this.getWsSessionId(),
    };
    this.activeMatchRequest = requestWithUserId;
    if (!this.send('match_request', requestWithUserId, true)) {
      console.error('Failed to send match request - WebSocket not connected');
    }
  }

  clearMatchRequest() {
    this.activeMatchRequest = null;
    this.pendingMessages = this.pendingMessages.filter(
      (message) => message.type !== 'match_request'
    );
  }

  sendMessage(chatMessage) {
    const messageWithUserId = {
      ...chatMessage,
      userId: this.getWsSessionId(),
    };
    if (!this.send('chat_message', messageWithUserId, true)) {
      console.error('Failed to send message - WebSocket not connected, message queued');
      return false;
    }
    return true;
  }

  endChat(chatId) {
    if (!this.send('end_chat', { chatId, userId: this.getWsSessionId() }, true)) {
      console.error('Failed to send end chat - WebSocket not connected, queued');
    }
  }

  disconnect() {
    this.isIntentionallyClosed = true;
    this.clearMatchRequest();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  async ensureConnected() {
    if (this.isConnected()) {
      return true;
    }

    try {
      await this.connect();
      return true;
    } catch (error) {
      console.error('Failed to ensure WebSocket connection:', error);
      return false;
    }
  }

  getConnectionState() {
    if (!this.ws) return 'CLOSED';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING';
      case WebSocket.OPEN:
        return 'OPEN';
      case WebSocket.CLOSING:
        return 'CLOSING';
      case WebSocket.CLOSED:
        return 'CLOSED';
      default:
        return 'UNKNOWN';
    }
  }
}

const wsService = new WebSocketService();

export default wsService;
