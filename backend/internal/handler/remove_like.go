package handler

import (
	"encoding/json"
	"io"
	"log"
	"net/http"

	"github.com/kurokolover/SideTalk/internal/usecase"
)

type RemoveLikeRequest struct {
	ID string `json:"id"`
}

func NewRemoveLikeHandler(usecase *usecase.RemoveLikeUsecase) *RemoveLikeHandler {
	return &RemoveLikeHandler{usecase: usecase}
}

type RemoveLikeHandler struct {
	usecase *usecase.RemoveLikeUsecase
}

func (h *RemoveLikeHandler) Handle(w http.ResponseWriter, r *http.Request) {
	data, err := io.ReadAll(r.Body)
	if err != nil {
		log.Printf("can't read body: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	req := &RemoveLikeRequest{}
	err = json.Unmarshal(data, &req)
	if err != nil {
		log.Printf("can't unpack(unmarshal) %v", err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	err = h.usecase.Unlike(r.Context(), req.ID)
	if err != nil {
		log.Printf("can't remove like from history: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}
