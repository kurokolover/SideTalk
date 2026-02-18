-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS history (
    id VARCHAR(255) PRIMARY KEY,
    text TEXT NOT NULL DEFAULT '',
    comments JSONB DEFAULT '[]'::jsonb,
    time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    likes_counter INTEGER DEFAULT 0
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS history;
-- +goose StatementEnd