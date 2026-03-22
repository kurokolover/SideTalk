package usecase

import (
	"context"
	"fmt"

	"github.com/kurokolover/SideTalk/internal/repo"
)

func NewRemoveLikeUsecase(repo *repo.HistoryTable) *RemoveLikeUsecase {
	return &RemoveLikeUsecase{repo: repo}
}

type RemoveLikeUsecase struct {
	repo *repo.HistoryTable
}

func (uc *RemoveLikeUsecase) Unlike(ctx context.Context, id string) error {
	err := uc.repo.DecrementLikes(ctx, id)
	if err != nil {
		return fmt.Errorf("can't remove like from history: %w", err)
	}
	return nil
}
