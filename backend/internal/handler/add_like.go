package handler

import (
	"encoding/json"
	"io"
	"log"
	"net/http"

	"github.com/kurokolover/SideTalk/internal/usecase"
)

type AddLikeRequest struct {
	ID string `json:"id"`
}

func NewAddLikeHandler(usecase *usecase.AddLikeUsecase) *AddLikeHandler {
	return &AddLikeHandler{usecase: usecase}
}

type AddLikeHandler struct {
	usecase *usecase.AddLikeUsecase
}

func (h *AddLikeHandler) Handle(w http.ResponseWriter, r *http.Request) {
	data, err := io.ReadAll(r.Body)
	if err != nil {
		log.Printf("can't read body: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	req := &AddLikeRequest{}
	err = json.Unmarshal(data, &req)
	if err != nil {
		log.Printf("can't unpack(unmarshal) %v", err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	err = h.usecase.Like(r.Context(), req.ID)
	if err != nil {
		log.Printf("can't add like on history: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}
