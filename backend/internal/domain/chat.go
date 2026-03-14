package domain

import "time"

type UserFilters struct {
	MyAge      string `json:"myAge"`
	MyGender   string `json:"myGender"`
	PeerAge    string `json:"peerAge"`
	PeerGender string `json:"peerGender"`
}

type MatchRequest struct {
	UserID        string      `json:"userId"`
	Language      string      `json:"language"`
	AntiBullying  bool        `json:"antiBullying"`
	GeoEnabled    bool        `json:"geoEnabled"`
	Country       string      `json:"selectedCountry,omitempty"`
	FilterEnabled bool        `json:"filterEnabled"`
	Filters       UserFilters `json:"filters"`
	Avatar        string      `json:"avatar,omitempty"`
}

type ChatSession struct {
	ID        string    `json:"id"`
	User1ID   string    `json:"user1Id"`
	User2ID   string    `json:"user2Id"`
	CreatedAt time.Time `json:"createdAt"`
	Active    bool      `json:"active"`
}

type ChatMessage struct {
	ID        string    `json:"id"`
	ChatID    string    `json:"chatId"`
	FromID    string    `json:"fromId"`
	Text      string    `json:"text"`
	Timestamp time.Time `json:"timestamp"`
}

// WebSocket message types
type WSMessage struct {
	Type    string      `json:"type"` // "match_request", "match_found", "chat_message", "peer_disconnected", "error"
	Payload interface{} `json:"payload"`
}

// match is found
type MatchFoundPayload struct {
	ChatID      string `json:"chatId"`
	PeerID      string `json:"peerId"`
	PeerCountry string `json:"peerCountry,omitempty"`
	PeerAvatar  string `json:"peerAvatar,omitempty"`
}

type ChatMessagePayload struct {
	MessageID string `json:"messageId"`
	ChatID    string `json:"chatId"`
	Text      string `json:"text"`
	Timestamp int64  `json:"timestamp"`
	FromMe    bool   `json:"fromMe"`
}
