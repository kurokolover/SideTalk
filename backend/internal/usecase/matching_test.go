package usecase

import (
	"testing"
	"time"

	"github.com/kurokolover/SideTalk/internal/domain"
)

func TestMatchingServiceCreatesPairsForFourClients(t *testing.T) {
	service := NewMatchingService()

	first := service.AddToQueue(matchRequestForTest("client-1"))
	second := service.AddToQueue(matchRequestForTest("client-2"))
	third := service.AddToQueue(matchRequestForTest("client-3"))
	fourth := service.AddToQueue(matchRequestForTest("client-4"))

	firstSession := receiveSessionForTest(t, first)
	secondSession := receiveSessionForTest(t, second)
	thirdSession := receiveSessionForTest(t, third)
	fourthSession := receiveSessionForTest(t, fourth)

	if firstSession.ID != secondSession.ID {
		t.Fatalf("first pair got different sessions: %s != %s", firstSession.ID, secondSession.ID)
	}
	if thirdSession.ID != fourthSession.ID {
		t.Fatalf("second pair got different sessions: %s != %s", thirdSession.ID, fourthSession.ID)
	}
	if firstSession.ID == thirdSession.ID {
		t.Fatalf("expected two different chat sessions, got %s", firstSession.ID)
	}
}

func TestMatchingServiceTreatsEmptyFiltersAsAny(t *testing.T) {
	service := NewMatchingService()

	filtered := matchRequestForTest("filtered-client")
	filtered.FilterEnabled = true
	filtered.Filters.PeerAge = "18–25"
	filtered.Filters.PeerGender = "female"

	unfiltered := domain.MatchRequest{
		UserID:        "unfiltered-client",
		Language:      "ru",
		FilterEnabled: false,
	}

	filteredChan := service.AddToQueue(filtered)
	unfilteredChan := service.AddToQueue(unfiltered)

	filteredSession := receiveSessionForTest(t, filteredChan)
	unfilteredSession := receiveSessionForTest(t, unfilteredChan)

	if filteredSession.ID != unfilteredSession.ID {
		t.Fatalf("expected clients to match with empty filters as any")
	}
}

func matchRequestForTest(userID string) domain.MatchRequest {
	return domain.MatchRequest{
		UserID:        userID,
		Language:      "ru",
		FilterEnabled: true,
		Filters: domain.UserFilters{
			MyAge:      "any",
			MyGender:   "any",
			PeerAge:    "any",
			PeerGender: "any",
		},
	}
}

func receiveSessionForTest(t *testing.T, sessionChan chan *domain.ChatSession) *domain.ChatSession {
	t.Helper()

	select {
	case session := <-sessionChan:
		if session == nil {
			t.Fatal("received nil session")
		}
		return session
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for match")
	}

	return nil
}
