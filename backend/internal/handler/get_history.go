package handler

import (
	"encoding/json"
	"io"
	"log"
	"net/http"

	"github.com/kurokolover/SideTalk/internal/domain"
	"github.com/kurokolover/SideTalk/internal/usecase"
)

type GetHistoryResponse struct {
	Data []domain.History `json:"data"`
}

func NewGetHistoryHandler(usecase *usecase.GetHistoryUsecase) *GetHistoryHandler {
	return &GetHistoryHandler{usecase: usecase}
}

type GetHistoryHandler struct {
	usecase *usecase.GetHistoryUsecase
}

func (h *GetHistoryHandler) Handle(w http.ResponseWriter, r *http.Request) {
	histories, err := h.usecase.GetHistories(r.Context())
	if err != nil {
		log.Printf("can't get histories: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	resp := &GetHistoryResponse{
		Data: histories,
	}
	data, err := json.Marshal(resp)
	if err != nil {
		log.Printf("can't marshal data with histories: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)
	io.Writer.Write(w, data)
}
