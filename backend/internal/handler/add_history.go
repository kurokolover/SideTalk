package handler

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/kurokolover/SideTalk/internal/domain"
	"github.com/kurokolover/SideTalk/internal/usecase"
)

type AddHistoryRequest struct {
	ID       string `json:"id"`
	AuthorID string `json:"author_id"`
	Text     string `json:"text"`
}

func NewAddHistoryHandler(usecase *usecase.AddHistoryUsecase) *AddHistoryHandler {
	return &AddHistoryHandler{usecase: usecase}
}

type AddHistoryHandler struct {
	usecase *usecase.AddHistoryUsecase
}

func (h *AddHistoryHandler) Handle(w http.ResponseWriter, r *http.Request) {
	data, err := io.ReadAll(r.Body)
	if err != nil {
		log.Printf("can't read body: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	req := &AddHistoryRequest{}
	err = json.Unmarshal(data, &req)
	if err != nil {
		log.Printf("can't unpack(unmarshal) %v", err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	err = h.validateRequest(req)
	if err != nil {
		log.Printf("validation error: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		io.WriteString(w, err.Error())
		return
	}

	err = h.usecase.AddHistory(r.Context(), domain.History{
		ID:           req.ID,
		AuthorID:     req.AuthorID,
		Text:         req.Text,
		Time:         time.Now(),
		LikesCounter: 0,
	})
	if err != nil {
		log.Printf("can't add history: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *AddHistoryHandler) validateRequest(req *AddHistoryRequest) error {
	if req.ID == "" {
		return errors.New("id field is empty")
	}
	if req.AuthorID == "" {
		return errors.New("author_id field is empty")
	}
	if req.Text == "" {
		return errors.New("text field is empty")
	}
	return nil
}
