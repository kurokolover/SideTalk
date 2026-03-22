package usecase

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/kurokolover/SideTalk/internal/domain"
)

type Client struct {
	ID       string
	Conn     *websocket.Conn
	Send     chan []byte
	Hub      *Hub
	mu       sync.Mutex
	chatID   string
	UserData domain.MatchRequest
	userData domain.MatchRequest
	ctx      context.Context
	cancel   context.CancelFunc
}

func NewClient(id string, conn *websocket.Conn, hub *Hub) *Client {
	ctx, cancel := context.WithCancel(context.Background())
	return &Client{
		ID:     id,
		Conn:   conn,
		Send:   make(chan []byte, 256),
		Hub:    hub,
		ctx:    ctx,
		cancel: cancel,
	}
}

func (c *Client) SetChatID(id string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.chatID = id
}

func (c *Client) GetChatID() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.chatID
}

func (c *Client) SetUserData(data domain.MatchRequest) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.userData = data
}

func (c *Client) GetUserData() domain.MatchRequest {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.userData
}

type Hub struct {
	clients         map[string]*Client
	broadcast       chan []byte
	Register        chan *Client
	unregister      chan *Client
	mu              sync.RWMutex
	matchingService *MatchingService
}

func NewHub(matchingService *MatchingService) *Hub {
	return &Hub{
		clients:         make(map[string]*Client),
		broadcast:       make(chan []byte, 256),
		Register:        make(chan *Client),
		unregister:      make(chan *Client),
		matchingService: matchingService,
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mu.Lock()
			h.clients[client.ID] = client
			h.mu.Unlock()
			log.Printf("Client registered: %s", client.ID)

		case client := <-h.unregister:
			chatID := client.GetChatID()
			userID := client.GetUserData().UserID

			h.mu.Lock()
			if _, ok := h.clients[client.ID]; ok {
				delete(h.clients, client.ID)
				close(client.Send)

				h.matchingService.RemoveFromQueue(userID)

				if chatID != "" {
					if peerID, ok := h.matchingService.GetPeerIDNoLock(chatID, userID); ok {
						h.notifyPeerDisconnectedLocked(peerID)
					}
				}
			}
			h.mu.Unlock()

			if chatID != "" {
				h.matchingService.EndSession(chatID)
			}

			log.Printf("Client unregistered: %s", client.ID)

		case message := <-h.broadcast:
			h.mu.Lock()
			for _, client := range h.clients {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					delete(h.clients, client.ID)
				}
			}
			h.mu.Unlock()
		}
	}
}

func (h *Hub) SendToClient(clientID string, message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if client, ok := h.clients[clientID]; ok {
		select {
		case client.Send <- message:
		default:
			log.Printf("Failed to send message to client %s", clientID)
		}
	}
}

func (h *Hub) SendToUser(userID string, message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, client := range h.clients {
		if client.GetUserData().UserID == userID {
			select {
			case client.Send <- message:
				log.Printf("Message sent to user %s", userID)
			default:
				log.Printf("Failed to send message to user %s", userID)
			}
			return
		}
	}
	log.Printf("User %s not found for message delivery", userID)
}

func (h *Hub) GetClient(clientID string) (*Client, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	client, ok := h.clients[clientID]
	return client, ok
}

func (h *Hub) GetClientByUserID(userID string) (*Client, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, client := range h.clients {
		if client.GetUserData().UserID == userID {
			return client, true
		}
	}
	return nil, false
}

func (h *Hub) notifyPeerDisconnected(userID string) {
	data, err := marshalPeerDisconnectedMsg()
	if err != nil {
		log.Printf("Error marshaling peer_disconnected message: %v", err)
		return
	}

	if client, ok := h.GetClientByUserID(userID); ok {
		select {
		case client.Send <- data:
			log.Printf("Sent peer_disconnected notification to user %s", userID)
		default:
			log.Printf("Channel full, failed to notify peer %s", userID)
		}
	} else {
		log.Printf("Could not find client for user %s to send peer_disconnected", userID)
	}
}

func (h *Hub) notifyPeerDisconnectedLocked(userID string) {
	data, err := marshalPeerDisconnectedMsg()
	if err != nil {
		log.Printf("Error marshaling peer_disconnected message: %v", err)
		return
	}

	for _, client := range h.clients {
		if client.GetUserData().UserID == userID {
			select {
			case client.Send <- data:
				log.Printf("Sent peer_disconnected notification to user %s", userID)
			default:
				log.Printf("Channel full, failed to notify peer %s", userID)
			}
			return
		}
	}
	log.Printf("Could not find client for user %s to send peer_disconnected", userID)
}

func (h *Hub) notifyPeerChatEnded(userID string) {
	data, err := marshalPeerChatEndedMsg()
	if err != nil {
		log.Printf("Error marshaling peer_chat_ended message: %v", err)
		return
	}

	if client, ok := h.GetClientByUserID(userID); ok {
		select {
		case client.Send <- data:
			log.Printf("Sent peer_chat_ended notification to user %s", userID)
		default:
			log.Printf("Channel full, failed to notify peer %s", userID)
		}
	} else {
		log.Printf("Could not find client for user %s to send peer_chat_ended", userID)
	}
}

func (h *Hub) notifyPeerChatEndedLocked(userID string) {
	data, err := marshalPeerChatEndedMsg()
	if err != nil {
		log.Printf("Error marshaling peer_chat_ended message: %v", err)
		return
	}

	for _, client := range h.clients {
		if client.GetUserData().UserID == userID {
			select {
			case client.Send <- data:
				log.Printf("Sent peer_chat_ended notification to user %s", userID)
			default:
				log.Printf("Channel full, failed to notify peer %s", userID)
			}
			return
		}
	}
	log.Printf("Could not find client for user %s to send peer_chat_ended", userID)
}

func marshalPeerDisconnectedMsg() ([]byte, error) {
	msg := domain.WSMessage{
		Type:    "peer_disconnected",
		Payload: map[string]string{"message": "Your chat partner has disconnected"},
	}
	return json.Marshal(msg)
}

func marshalPeerChatEndedMsg() ([]byte, error) {
	msg := domain.WSMessage{
		Type: "peer_chat_ended",
		Payload: map[string]string{
			"message": "Your chat partner ended the chat",
		},
	}
	return json.Marshal(msg)
}

func (c *Client) ReadPump() {
	defer func() {
		c.cancel()
		c.Hub.unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))

		c.handleMessage(message)
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) handleMessage(message []byte) {
	var wsMsg domain.WSMessage
	if err := json.Unmarshal(message, &wsMsg); err != nil {
		log.Printf("Error unmarshaling message: %v", err)
		c.sendError("Invalid message format")
		return
	}

	switch wsMsg.Type {
	case "user_identify":
		c.handleUserIdentify(wsMsg.Payload)
	case "match_request":
		c.handleMatchRequest(wsMsg.Payload)
	case "chat_message":
		c.handleChatMessage(wsMsg.Payload)
	case "end_chat":
		c.handleEndChat()
	default:
		log.Printf("Unknown message type: %s", wsMsg.Type)
		c.sendError("Unknown message type")
	}
}

func (c *Client) handleUserIdentify(payload interface{}) {
	data, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Error marshaling user_identify payload: %v", err)
		return
	}

	var identifyPayload struct {
		UserID string `json:"userId"`
	}
	if err := json.Unmarshal(data, &identifyPayload); err != nil {
		log.Printf("Error unmarshaling user_identify: %v", err)
		return
	}

	if identifyPayload.UserID != "" {
		ud := c.GetUserData()
		ud.UserID = identifyPayload.UserID
		c.SetUserData(ud)
		log.Printf("User identified: %s (WebSocket client: %s)", identifyPayload.UserID, c.ID)
	}
}

func (c *Client) handleMatchRequest(payload interface{}) {
	data, err := json.Marshal(payload)
	if err != nil {
		c.sendError("Invalid match request payload")
		return
	}

	var req domain.MatchRequest
	if err := json.Unmarshal(data, &req); err != nil {
		c.sendError("Invalid match request format")
		return
	}

	if req.UserID == "" {
		req.UserID = c.ID
	}
	c.SetUserData(req)

	responseChan := c.Hub.matchingService.AddToQueue(req)

	go func() {
		select {
		case session, ok := <-responseChan:
			if !ok {
				log.Printf("Match request cancelled for client %s: response channel closed", c.ID)
				return
			}
			if session == nil {
				log.Printf("Received nil session for client %s", c.ID)
				return
			}

			c.SetChatID(session.ID)

			userData := c.GetUserData()
			peerID := session.User2ID
			if session.User2ID == userData.UserID {
				peerID = session.User1ID
			}

			peerCountry := ""
			peerAvatar := ""
			if peer, ok := c.Hub.GetClientByUserID(peerID); ok {
				peerData := peer.GetUserData()
				peerCountry = peerData.Country
				peerAvatar = peerData.Avatar
				peer.SetChatID(session.ID)
				log.Printf("Set ChatID %s for peer %s", session.ID, peerID)
			}

			matchPayload := domain.MatchFoundPayload{
				ChatID:       session.ID,
				PeerID:       peerID,
				PeerCountry:  peerCountry,
				PeerAvatar:   peerAvatar,
				AntiBullying: session.AntiBullying,
			}

			msg := domain.WSMessage{
				Type:    "match_found",
				Payload: matchPayload,
			}

			msgData, err := json.Marshal(msg)
			if err != nil {
				log.Printf("Error marshaling match_found message: %v", err)
				return
			}

			select {
			case c.Send <- msgData:
				log.Printf("Match found notification sent to client %s for chat %s", c.ID, session.ID)
			default:
				log.Printf("Failed to send match_found to client %s: channel full", c.ID)
			}

		case <-time.After(60 * time.Second):
			c.Hub.matchingService.RemoveFromQueue(c.GetUserData().UserID)
			c.sendError("No match found. Please try again.")

		case <-c.ctx.Done():
			log.Printf("Match request cancelled for client %s: context done", c.ID)
		}
	}()
}

func (c *Client) handleChatMessage(payload interface{}) {
	chatID := c.GetChatID()
	log.Printf("handleChatMessage called for client %s, ChatID: %s", c.ID, chatID)

	data, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Error marshaling payload: %v", err)
		c.sendError("Invalid message payload")
		return
	}

	var msgPayload domain.ChatMessagePayload
	if err := json.Unmarshal(data, &msgPayload); err != nil {
		log.Printf("Error unmarshaling message: %v", err)
		c.sendError("Invalid message format")
		return
	}

	log.Printf("Received message from client %s: chatId=%s, text=%s", c.ID, msgPayload.ChatID, msgPayload.Text)

	if chatID == "" && msgPayload.ChatID != "" {
		chatID = msgPayload.ChatID
		c.SetChatID(chatID)
		log.Printf("Updated client %s ChatID from payload: %s", c.ID, chatID)
	}

	if chatID == "" {
		log.Printf("Client %s not in an active chat", c.ID)
		c.sendError("Not in an active chat")
		return
	}

	userData := c.GetUserData()
	peerID, ok := c.Hub.matchingService.GetPeerID(chatID, userData.UserID)
	if !ok {
		log.Printf("Chat session %s not found for client %s", chatID, userData.UserID)
		c.sendError("Chat session not found")
		return
	}

	log.Printf("Forwarding message from %s to peer %s in chat %s", userData.UserID, peerID, chatID)

	msgPayload.FromMe = false
	msg := domain.WSMessage{
		Type:    "chat_message",
		Payload: msgPayload,
	}

	msgData, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Error marshaling chat_message: %v", err)
		c.sendError("Failed to send message")
		return
	}

	c.Hub.SendToUser(peerID, msgData)
	log.Printf("Message forwarded successfully to peer %s", peerID)
}

func (c *Client) handleEndChat() {
	chatID := c.GetChatID()
	log.Printf("handleEndChat called for client %s, ChatID: %s", c.ID, chatID)

	if chatID == "" {
		log.Printf("Client %s has no active chat to end", c.ID)
		return
	}

	userData := c.GetUserData()

	if peerID, ok := c.Hub.matchingService.GetPeerID(chatID, userData.UserID); ok {
		log.Printf("Notifying peer %s about chat end", peerID)
		c.Hub.notifyPeerChatEnded(peerID)

		if peer, ok := c.Hub.GetClientByUserID(peerID); ok {
			peer.SetChatID("")
			log.Printf("Cleared ChatID for peer %s", peerID)
		}
	}

	c.Hub.matchingService.EndSession(chatID)
	c.SetChatID("")
	log.Printf("Chat %s ended by client %s", chatID, c.ID)
}

func (c *Client) sendError(message string) {
	msg := domain.WSMessage{
		Type:    "error",
		Payload: map[string]string{"message": message},
	}

	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Error marshaling error message: %v", err)
		return
	}

	select {
	case c.Send <- data:
	default:
		log.Printf("Failed to send error message to client %s", c.ID)
	}
}
