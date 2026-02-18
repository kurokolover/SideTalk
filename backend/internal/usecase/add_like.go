package usecase

import (
	"context"
	"fmt"

	"github.com/kurokolover/SideTalk/internal/repo"
)

func NewAddLikeUsecase(repo *repo.HistoryTable) *AddLikeUsecase {
	return &AddLikeUsecase{repo: repo}
}

type AddLikeUsecase struct {
	repo *repo.HistoryTable
}

func (uc *AddLikeUsecase) Like(ctx context.Context, id string) error {
	err := uc.repo.IncrementLikes(ctx, id)
	if err != nil {
		return fmt.Errorf("can't add like on history: %w", err)
	}
	return nil
}
