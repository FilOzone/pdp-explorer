package models

import (
	"time"

	"github.com/jmoiron/sqlx/types"
)

type EventLog struct {
	ReorgModel

	SetId           int64          `db:"set_id"`
	Address         string         `db:"address"`
	Name            string         `db:"name"`
	Data            types.JSONText `db:"data"`
	LogIndex        int64          `db:"log_index"`
	Removed         bool           `db:"removed"`
	Topics          []string       `db:"topics"`
	TransactionHash string         `db:"transaction_hash"`
	CreatedAt       time.Time      `db:"created_at"`
}