-- +goose Up
-- +goose StatementBegin
ALTER TABLE history ADD COLUMN author_id VARCHAR(255) NOT NULL DEFAULT '';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE history DROP COLUMN author_id;
-- +goose StatementEnd
