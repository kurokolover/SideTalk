package usecase

import (
	"context"
	"fmt"

	"github.com/kurokolover/SideTalk/internal/domain"
	"github.com/kurokolover/SideTalk/internal/repo"
)

func NewGetHistoryUsecase(repo *repo.HistoryTable) *GetHistoryUsecase {
	return &GetHistoryUsecase{repo: repo}
}

type GetHistoryUsecase struct {
	repo *repo.HistoryTable
}

func (uc *GetHistoryUsecase) GetHistories(ctx context.Context) ([]domain.History, error) {
	data, err := uc.repo.GetAll(ctx)
	if err != nil {
		return nil, fmt.Errorf("can't get all histories from repo: %w", err)
	}
	if data == nil {
		data = []domain.History{}
	}
	return data, nil
}
