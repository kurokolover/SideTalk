package usecase

import (
	"context"
	"fmt"

	"github.com/kurokolover/SideTalk/internal/domain"
	"github.com/kurokolover/SideTalk/internal/repo"
)

func NewAddHistoryUsecase(repo *repo.HistoryTable) *AddHistoryUsecase {
	return &AddHistoryUsecase{repo: repo}
}

type AddHistoryUsecase struct {
	repo *repo.HistoryTable
}

func (uc *AddHistoryUsecase) AddHistory(ctx context.Context, history domain.History) error {
	err := uc.repo.Create(ctx, history)
	if err != nil {
		return fmt.Errorf("can't add new history: %w", err)
	}
	return nil
}
