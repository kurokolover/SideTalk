package handler

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"

	"github.com/kurokolover/SideTalk/internal/domain"
	"github.com/kurokolover/SideTalk/internal/usecase"
)

type AddCommentRequest struct {
	HistoryID string `json:"history_id"`
	ID        string `json:"id"`
	AuthorID  string `json:"author_id"`
	Text      string `json:"text"`
}

type AddCommentHandler struct {
	usecase *usecase.AddCommentUsecase
}

func NewAddCommentHandler(usecase *usecase.AddCommentUsecase) *AddCommentHandler {
	return &AddCommentHandler{usecase: usecase}
}

func (h *AddCommentHandler) Handle(w http.ResponseWriter, r *http.Request) {
	data, err := io.ReadAll(r.Body)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		io.WriteString(w, "error while reading")
		return
	}

	req := &AddCommentRequest{}
	err = json.Unmarshal(data, &req)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		io.WriteString(w, "error while unmarshal")
		return
	}

	err = h.validateRequest(req)
	if err != nil {
		log.Printf("Validation error: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		io.WriteString(w, err.Error())
		return
	}

	err = h.usecase.AddComment(r.Context(), req.HistoryID, domain.Comment{
		ID:       req.ID,
		AuthorID: req.AuthorID,
		Text:     req.Text,
	})
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Printf("cant add comment by repo: %v", err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *AddCommentHandler) validateRequest(data *AddCommentRequest) error {
	if data.ID == "" {
		return errors.New("empty id field")
	}
	if data.HistoryID == "" {
		return errors.New("empty history_id field")
	}
	if data.AuthorID == "" {
		return errors.New("empty author_id field")
	}
	if data.Text == "" {
		return errors.New("empty text field")
	}
	return nil
}
