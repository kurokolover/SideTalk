package usecase

import (
	"crypto/rand"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/kurokolover/SideTalk/internal/domain"
)

type MatchingService struct {
	mu             sync.RWMutex
	waitingUsers   map[string]*WaitingUser
	activeSessions map[string]*domain.ChatSession
}

type WaitingUser struct {
	UserID       string
	Request      domain.MatchRequest
	JoinedAt     time.Time
	ResponseChan chan *domain.ChatSession
	done         chan struct{}
}

func NewMatchingService() *MatchingService {
	return &MatchingService{
		waitingUsers:   make(map[string]*WaitingUser),
		activeSessions: make(map[string]*domain.ChatSession),
	}
}

func (s *MatchingService) AddToQueue(req domain.MatchRequest) chan *domain.ChatSession {
	s.mu.Lock()
	defer s.mu.Unlock()

	log.Printf("AddToQueue: UserID=%s, Language=%s, GeoEnabled=%v, Country=%s, FilterEnabled=%v",
		req.UserID, req.Language, req.GeoEnabled, req.Country, req.FilterEnabled)

	if existing, exists := s.waitingUsers[req.UserID]; exists {
		close(existing.done)
		delete(s.waitingUsers, req.UserID)
		log.Printf("Replaced existing queue entry for user %s", req.UserID)
	}

	responseChan := make(chan *domain.ChatSession, 1)

	waiting := &WaitingUser{
		UserID:       req.UserID,
		Request:      req,
		JoinedAt:     time.Now(),
		ResponseChan: responseChan,
		done:         make(chan struct{}),
	}

	match := s.findMatch(waiting)
	if match != nil {
		log.Printf("Match found! User1=%s, User2=%s", waiting.UserID, match.UserID)

		session := s.createSession(waiting.UserID, match.UserID)

		waiting.ResponseChan <- session
		match.ResponseChan <- session

		delete(s.waitingUsers, match.UserID)

		return responseChan
	}

	log.Printf("No match found for user %s, adding to queue. Queue size: %d", req.UserID, len(s.waitingUsers)+1)
	s.waitingUsers[req.UserID] = waiting
	return responseChan
}

func (s *MatchingService) RemoveFromQueue(userID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if waiting, exists := s.waitingUsers[userID]; exists {
		close(waiting.done)
		delete(s.waitingUsers, userID)
		log.Printf("Removed user %s from queue", userID)
	}
}

func (s *MatchingService) findMatch(user *WaitingUser) *WaitingUser {
	for _, candidate := range s.waitingUsers {
		if candidate.UserID == user.UserID {
			continue
		}

		if s.isCompatible(user.Request, candidate.Request) {
			return candidate
		}
	}
	return nil
}

func (s *MatchingService) isCompatible(req1, req2 domain.MatchRequest) bool {
	log.Printf(
		"Checking compatibility: User1=%s (Lang=%s, Geo=%v, Country=%s), User2=%s (Lang=%s, Geo=%v, Country=%s)",
		req1.UserID, req1.Language, req1.GeoEnabled, req1.Country,
		req2.UserID, req2.Language, req2.GeoEnabled, req2.Country,
	)

	if req1.Language != req2.Language {
		log.Printf("Language mismatch: %s != %s", req1.Language, req2.Language)
		return false
	}

	if req1.GeoEnabled || req2.GeoEnabled {
		if req1.Country != "" && req2.Country != "" && req1.Country != req2.Country {
			log.Printf("Country mismatch: %s != %s", req1.Country, req2.Country)
			return false
		}
	}

	if !req1.FilterEnabled && !req2.FilterEnabled {
		log.Printf("Both users have filters disabled - compatible!")
		return true
	}

	if req1.FilterEnabled && !req2.FilterEnabled {
		compatible := s.matchesFilters(req1.Filters, req2.Filters)
		log.Printf("User1 has filters, User2 doesn't - compatible: %v", compatible)
		return compatible
	}
	if !req1.FilterEnabled && req2.FilterEnabled {
		compatible := s.matchesFilters(req2.Filters, req1.Filters)
		log.Printf("User2 has filters, User1 doesn't - compatible: %v", compatible)
		return compatible
	}

	compatible := s.matchesFilters(req1.Filters, req2.Filters) &&
		s.matchesFilters(req2.Filters, req1.Filters)
	log.Printf("Both users have filters - compatible: %v", compatible)
	return compatible
}

func (s *MatchingService) matchesFilters(filters1, filters2 domain.UserFilters) bool {
	if filters1.PeerAge != "any" {
		if filters1.PeerAge != filters2.MyAge {
			return false
		}
	}

	if filters1.PeerGender != "any" {
		if filters1.PeerGender != filters2.MyGender {
			return false
		}
	}

	return true
}

func (s *MatchingService) createSession(user1ID, user2ID string) *domain.ChatSession {
	session := &domain.ChatSession{
		ID:        generateSessionID(),
		User1ID:   user1ID,
		User2ID:   user2ID,
		CreatedAt: time.Now(),
		Active:    true,
	}

	s.activeSessions[session.ID] = session
	return session
}

func (s *MatchingService) GetSession(sessionID string) (*domain.ChatSession, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	session, exists := s.activeSessions[sessionID]
	return session, exists
}

func (s *MatchingService) EndSession(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if session, exists := s.activeSessions[sessionID]; exists {
		session.Active = false
		delete(s.activeSessions, sessionID)
		log.Printf("Session %s ended", sessionID)
	}
}

func (s *MatchingService) GetPeerID(sessionID, userID string) (string, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.getPeerIDLocked(sessionID, userID)
}

func (s *MatchingService) GetPeerIDNoLock(sessionID, userID string) (string, bool) {
	return s.getPeerIDLocked(sessionID, userID)
}

func (s *MatchingService) getPeerIDLocked(sessionID, userID string) (string, bool) {
	session, exists := s.activeSessions[sessionID]
	if !exists || session == nil {
		return "", false
	}

	switch userID {
	case session.User1ID:
		return session.User2ID, true
	case session.User2ID:
		return session.User1ID, true
	default:
		return "", false
	}
}

func generateSessionID() string {
	randomBytes := make([]byte, 6)
	if _, err := rand.Read(randomBytes); err != nil {
		panic(fmt.Sprintf("generateSessionID: failed to read random bytes: %v", err))
	}
	digits := make([]byte, 6)
	for i, b := range randomBytes {
		digits[i] = '0' + (b % 10)
	}
	return "id" + string(digits)
}

func randomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	randomBytes := make([]byte, length)

	if _, err := rand.Read(randomBytes); err != nil {
		panic(fmt.Sprintf("randomString: failed to read random bytes: %v", err))
	}

	result := make([]byte, length)
	for i, b := range randomBytes {
		result[i] = charset[int(b)%len(charset)]
	}
	return string(result)
}
