import { BACKEND_URL } from './config';
import userService from './userService';

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
  }

  getUserId() {
    if (!this.userId) {
      this.userId = userService.getUserId();
    }
    return this.userId;
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
      try {
        const wsUrl = BACKEND_URL.replace('http', 'ws') + '/ws';
        console.log('Connecting to WebSocket:', wsUrl);
        this.ws = new WebSocket(wsUrl);
        this.isIntentionallyClosed = false;

        this.ws.onopen = () => {
          console.log('WebSocket connected successfully');
          this.reconnectAttempts = 0;
          this.connectionPromise = null;

          this.sendUserIdentification();

          this.notifyListeners('connected', { userId: this.getUserId() });

          this.flushPendingMessages();

          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const messages = event.data.split('\n').filter(m => m.trim());
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

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.connectionPromise = null;
          this.notifyListeners('error', { message: 'WebSocket connection error' });
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected', event.code, event.reason);
          this.connectionPromise = null;
          this.notifyListeners('disconnected', { code: event.code, reason: event.reason });
          if (!this.isIntentionallyClosed) {
            this.attemptReconnect();
          }
        };
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
          this.pendingMessages.push({ type, payload });
        }
        return false;
      }
    } else {
      console.error('WebSocket is not connected, state:', this.getConnectionState());

      if (queueIfDisconnected) {
        console.log('Queueing message for later:', type);
        this.pendingMessages.push({ type, payload });
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
    const userId = this.getUserId();
    console.log('Sending user identification:', userId);
    this.send('user_identify', { userId });
  }

  requestMatch(matchRequest) {
    const requestWithUserId = {
      ...matchRequest,
      userId: this.getUserId(),
    };
    if (!this.send('match_request', requestWithUserId)) {
      console.error('Failed to send match request - WebSocket not connected');
    }
  }

  sendMessage(chatMessage) {
    const messageWithUserId = {
      ...chatMessage,
      userId: this.getUserId(),
    };
    if (!this.send('chat_message', messageWithUserId, true)) {
      console.error('Failed to send message - WebSocket not connected, message queued');
      return false;
    }
    return true;
  }

  endChat() {
    if (!this.send('end_chat', {}, true)) {
      console.error('Failed to send end chat - WebSocket not connected, queued');
    }
  }

  disconnect() {
    this.isIntentionallyClosed = true;
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
