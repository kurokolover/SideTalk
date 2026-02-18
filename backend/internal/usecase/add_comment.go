package usecase

import (
	"context"
	"fmt"

	"github.com/kurokolover/SideTalk/internal/domain"
	"github.com/kurokolover/SideTalk/internal/repo"
)

type AddCommentUsecase struct {
	repo *repo.HistoryTable
}

func NewAddCommentUsecase(repo *repo.HistoryTable) *AddCommentUsecase {
	return &AddCommentUsecase{repo: repo}
}

func (uc *AddCommentUsecase) AddComment(ctx context.Context, historyID string, comment domain.Comment) error {
	err := uc.repo.AddComment(ctx, historyID, comment)
	if err != nil {
		return fmt.Errorf("cant add comment to repo: %w", err)
	}
	return nil
}
