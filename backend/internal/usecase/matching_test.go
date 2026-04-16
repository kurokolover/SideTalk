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

func TestMatchingServiceCreatesFivePairsForTenClients(t *testing.T) {
	service := NewMatchingService()
	channels := make([]chan *domain.ChatSession, 0, 10)

	for i := 0; i < 10; i++ {
		channels = append(channels, service.AddToQueue(matchRequestForTest(
			"client-"+string(rune('A'+i)),
		)))
	}

	sessionCounts := make(map[string]int)
	for _, sessionChan := range channels {
		session := receiveSessionForTest(t, sessionChan)
		sessionCounts[session.ID]++
	}

	if len(sessionCounts) != 5 {
		t.Fatalf("expected 5 sessions for 10 clients, got %d", len(sessionCounts))
	}

	for sessionID, count := range sessionCounts {
		if count != 2 {
			t.Fatalf("expected session %s to have 2 participants, got %d", sessionID, count)
		}
	}
}

func TestMatchingServiceMatchesSameCountryAcrossLanguages(t *testing.T) {
	service := NewMatchingService()

	ru := matchRequestForTest("ru-client")
	en := matchRequestForTest("en-client")
	en.Language = "en"
	ru.GeoEnabled = true
	en.GeoEnabled = true
	ru.Country = "Литва"
	en.Country = "Lithuania"

	ruChan := service.AddToQueue(ru)
	enChan := service.AddToQueue(en)

	ruSession := receiveSessionForTest(t, ruChan)
	enSession := receiveSessionForTest(t, enChan)

	if ruSession.ID != enSession.ID {
		t.Fatalf("expected localized country values to match into one session")
	}
}

func TestMatchingServiceDoesNotMatchDifferentCountries(t *testing.T) {
	service := NewMatchingService()

	first := matchRequestForTest("first-client")
	second := matchRequestForTest("second-client")
	first.GeoEnabled = true
	second.GeoEnabled = true
	first.Country = "Литва"
	second.Country = "Latvia"

	firstChan := service.AddToQueue(first)
	secondChan := service.AddToQueue(second)

	assertNoSessionForTest(t, firstChan)
	assertNoSessionForTest(t, secondChan)
}

func TestMatchingServiceClosesPreviousQueueEntryOnRequeue(t *testing.T) {
	service := NewMatchingService()

	firstAttempt := service.AddToQueue(matchRequestForTest("same-user"))
	secondAttempt := service.AddToQueue(matchRequestForTest("same-user"))

	select {
	case session, ok := <-firstAttempt:
		if ok || session != nil {
			t.Fatal("expected previous queue entry to be closed without a session")
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for previous queue entry to close")
	}

	assertNoSessionForTest(t, secondAttempt)
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

func assertNoSessionForTest(t *testing.T, sessionChan chan *domain.ChatSession) {
	t.Helper()

	select {
	case session := <-sessionChan:
		if session != nil {
			t.Fatalf("expected no session, got %s", session.ID)
		}
	case <-time.After(150 * time.Millisecond):
	}
}
