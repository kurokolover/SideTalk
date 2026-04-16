package usecase

import (
	"crypto/rand"
	"fmt"
	"log"
	"sort"
	"strings"
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

func (w *WaitingUser) close() {
	close(w.done)
	close(w.ResponseChan)
}

var canonicalCountries = map[string]string{
	"russia":         "russia",
	"россия":         "russia",
	"belarus":        "belarus",
	"беларусь":       "belarus",
	"kazakhstan":     "kazakhstan",
	"казахстан":      "kazakhstan",
	"georgia":        "georgia",
	"грузия":         "georgia",
	"armenia":        "armenia",
	"армения":        "armenia",
	"azerbaijan":     "azerbaijan",
	"азербайджан":    "azerbaijan",
	"uzbekistan":     "uzbekistan",
	"узбекистан":     "uzbekistan",
	"moldova":        "moldova",
	"молдова":        "moldova",
	"latvia":         "latvia",
	"латвия":         "latvia",
	"lithuania":      "lithuania",
	"литва":          "lithuania",
	"estonia":        "estonia",
	"эстония":        "estonia",
	"poland":         "poland",
	"польша":         "poland",
	"germany":        "germany",
	"германия":       "germany",
	"france":         "france",
	"франция":        "france",
	"spain":          "spain",
	"испания":        "spain",
	"italy":          "italy",
	"италия":         "italy",
	"turkey":         "turkey",
	"турция":         "turkey",
	"usa":            "usa",
	"u.s.a.":         "usa",
	"united states":  "usa",
	"сша":            "usa",
	"canada":         "canada",
	"канада":         "canada",
	"united kingdom": "united kingdom",
	"great britain":  "united kingdom",
	"uk":             "united kingdom",
	"великобритания": "united kingdom",
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
		existing.close()
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
	s.waitingUsers[req.UserID] = waiting
	log.Printf("User %s added to queue. Queue size: %d", req.UserID, len(s.waitingUsers))

	s.matchWaitingUsersLocked()

	return responseChan
}

func (s *MatchingService) RemoveFromQueue(userID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if waiting, exists := s.waitingUsers[userID]; exists {
		waiting.close()
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

func (s *MatchingService) matchWaitingUsersLocked() {
	if len(s.waitingUsers) < 2 {
		return
	}

	waitingList := make([]*WaitingUser, 0, len(s.waitingUsers))
	for _, waitingUser := range s.waitingUsers {
		waitingList = append(waitingList, waitingUser)
	}

	sort.Slice(waitingList, func(i, j int) bool {
		return waitingList[i].JoinedAt.Before(waitingList[j].JoinedAt)
	})

	used := make(map[string]bool, len(waitingList))

	for i := 0; i < len(waitingList); i++ {
		current := waitingList[i]
		if current == nil || used[current.UserID] {
			continue
		}

		for j := i + 1; j < len(waitingList); j++ {
			candidate := waitingList[j]
			if candidate == nil || used[candidate.UserID] {
				continue
			}

			if !s.isCompatible(current.Request, candidate.Request) {
				continue
			}

			log.Printf("Match found! User1=%s, User2=%s", current.UserID, candidate.UserID)

			session := s.createSession(
				current.UserID,
				candidate.UserID,
				current.Request.AntiBullying || candidate.Request.AntiBullying,
			)

			current.ResponseChan <- session
			candidate.ResponseChan <- session
			current.close()
			candidate.close()

			used[current.UserID] = true
			used[candidate.UserID] = true

			delete(s.waitingUsers, current.UserID)
			delete(s.waitingUsers, candidate.UserID)
			break
		}
	}
}

func (s *MatchingService) isCompatible(req1, req2 domain.MatchRequest) bool {
	log.Printf(
		"Checking compatibility: User1=%s (Lang=%s, Geo=%v, Country=%s), User2=%s (Lang=%s, Geo=%v, Country=%s)",
		req1.UserID, req1.Language, req1.GeoEnabled, req1.Country,
		req2.UserID, req2.Language, req2.GeoEnabled, req2.Country,
	)

	if req1.GeoEnabled || req2.GeoEnabled {
		country1 := normalizeCountry(req1.Country)
		country2 := normalizeCountry(req2.Country)
		if country1 != "" && country2 != "" && country1 != country2 {
			log.Printf("Country mismatch: %s (%s) != %s (%s)", req1.Country, country1, req2.Country, country2)
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
	peerAge := normalizeFilterValue(filters1.PeerAge)
	myAge := normalizeFilterValue(filters2.MyAge)
	peerGender := normalizeFilterValue(filters1.PeerGender)
	myGender := normalizeFilterValue(filters2.MyGender)

	if peerAge != "any" && myAge != "any" {
		if peerAge != myAge {
			return false
		}
	}

	if peerGender != "any" && myGender != "any" {
		if peerGender != myGender {
			return false
		}
	}

	return true
}

func normalizeFilterValue(value string) string {
	if value == "" {
		return "any"
	}
	return value
}

func normalizeCountry(value string) string {
	normalized := strings.TrimSpace(strings.ToLower(value))
	if normalized == "" {
		return ""
	}

	if canonical, ok := canonicalCountries[normalized]; ok {
		return canonical
	}

	return normalized
}

func (s *MatchingService) createSession(user1ID, user2ID string, antiBullying bool) *domain.ChatSession {
	session := &domain.ChatSession{
		ID:           generateSessionID(),
		User1ID:      user1ID,
		User2ID:      user2ID,
		CreatedAt:    time.Now(),
		Active:       true,
		AntiBullying: antiBullying,
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
