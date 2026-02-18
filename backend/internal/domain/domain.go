package domain

import "time"

type Comment struct {
	ID       string `json:"id"`
	AuthorID string `json:"author_id"`
	Text     string `json:"text"`
}

type History struct {
	ID           string    `json:"id"`
	AuthorID     string    `json:"author_id"`
	Text         string    `json:"text"`
	Comments     []Comment `json:"comments"`
	Time         time.Time `json:"time"`
	LikesCounter int       `json:"likes"`
}
