package handler

import (
	"log"
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/kurokolover/SideTalk/internal/usecase"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins for development.
		// TODO: restrict to known origins in production.
		return true
	},
}

// WSHandler handles WebSocket connections
type WSHandler struct {
	hub *usecase.Hub
}

// NewWSHandler creates a new WebSocket handler
func NewWSHandler(hub *usecase.Hub) *WSHandler {
	return &WSHandler{hub: hub}
}

// HandleWebSocket upgrades the HTTP connection to WebSocket,
// registers the client with the hub and starts its read/write pumps.
func (h *WSHandler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	clientID := uuid.New().String()

	// NewClient initialises the Send channel, context and cancel func
	// so we never touch unexported fields from outside the usecase package.
	client := usecase.NewClient(clientID, conn, h.hub)

	// Register client with the hub before starting pumps so that
	// any message the hub wants to deliver is not lost.
	h.hub.Register <- client

	log.Printf("New WebSocket connection established: %s", clientID)

	// WritePump owns the write side of the connection and must run in its
	// own goroutine. ReadPump blocks until the connection is closed, so it
	// is also run in a goroutine to avoid blocking the HTTP handler.
	go client.WritePump()
	go client.ReadPump()
}
