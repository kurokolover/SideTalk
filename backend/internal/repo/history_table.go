package repo

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jmoiron/sqlx"
	"github.com/kurokolover/SideTalk/internal/domain"
	_ "github.com/lib/pq"
)

var (
	ErrNotFound = errors.New("record not found")
)

type HistoryTable struct {
	DB *sqlx.DB
}

func NewHistoryTable(db *sqlx.DB) *HistoryTable {
	return &HistoryTable{DB: db}
}

func (h *HistoryTable) Create(ctx context.Context, history domain.History) error {
	commentsJSON, err := json.Marshal(history.Comments)
	if err != nil {
		return fmt.Errorf("failed to marshal comments: %w", err)
	}

	query := `
		INSERT INTO history (id, author_id, text, comments, time, likes_counter)
		VALUES ($1, $2, $3, $4, $5, $6)
	`

	_, err = h.DB.ExecContext(ctx, query,
		history.ID,
		history.AuthorID,
		history.Text,
		commentsJSON,
		history.Time,
		history.LikesCounter,
	)
	if err != nil {
		return fmt.Errorf("failed to insert history: %w", err)
	}

	return nil
}

func (h *HistoryTable) GetByID(ctx context.Context, id string) (*domain.History, error) {
	query := `
		SELECT id, author_id, text, comments, time, likes_counter
		FROM history
		WHERE id = $1
	`

	var history domain.History
	var commentsJSON []byte

	err := h.DB.QueryRowContext(ctx, query, id).Scan(
		&history.ID,
		&history.AuthorID,
		&history.Text,
		&commentsJSON,
		&history.Time,
		&history.LikesCounter,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to get history: %w", err)
	}

	if err := json.Unmarshal(commentsJSON, &history.Comments); err != nil {
		return nil, fmt.Errorf("failed to unmarshal comments: %w", err)
	}

	return &history, nil
}

func (h *HistoryTable) GetAll(ctx context.Context) ([]domain.History, error) {
	query := `
		SELECT id, author_id, text, comments, time, likes_counter
		FROM history
		ORDER BY time DESC
	`

	rows, err := h.DB.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query history: %w", err)
	}
	defer rows.Close()

	var histories []domain.History
	for rows.Next() {
		var history domain.History
		var commentsJSON []byte

		if err := rows.Scan(
			&history.ID,
			&history.AuthorID,
			&history.Text,
			&commentsJSON,
			&history.Time,
			&history.LikesCounter,
		); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		if err := json.Unmarshal(commentsJSON, &history.Comments); err != nil {
			return nil, fmt.Errorf("failed to unmarshal comments: %w", err)
		}

		histories = append(histories, history)
	}

	return histories, rows.Err()
}

func (h *HistoryTable) Update(ctx context.Context, history domain.History) error {
	commentsJSON, err := json.Marshal(history.Comments)
	if err != nil {
		return fmt.Errorf("failed to marshal comments: %w", err)
	}

	query := `
		UPDATE history
		SET author_id = $1, text = $2, comments = $3, time = $4, likes_counter = $5
		WHERE id = $6
	`

	result, err := h.DB.ExecContext(ctx, query,
		history.AuthorID,
		history.Text,
		commentsJSON,
		history.Time,
		history.LikesCounter,
		history.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update history: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}

	return nil
}

func (h *HistoryTable) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM history WHERE id = $1`

	result, err := h.DB.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete history: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}

	return nil
}

func (h *HistoryTable) AddComment(ctx context.Context, historyID string, comment domain.Comment) error {
	history, err := h.GetByID(ctx, historyID)
	if err != nil {
		return err
	}

	history.Comments = append(history.Comments, comment)
	return h.Update(ctx, *history)
}

func (h *HistoryTable) IncrementLikes(ctx context.Context, id string) error {
	query := `UPDATE history SET likes_counter = likes_counter + 1 WHERE id = $1`

	result, err := h.DB.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to increment likes: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}

	return nil
}

func (h *HistoryTable) DecrementLikes(ctx context.Context, id string) error {
	query := `UPDATE history SET likes_counter = GREATEST(0, likes_counter - 1) WHERE id = $1`

	result, err := h.DB.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to decrement likes: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}

	return nil
}
