package models

import (
	"time"
)

// BaseModel interface defines methods that all models must implement
type Block struct {
	Height      int64     `db:"height"`
	Hash        string    `db:"hash"`
	ParentHash  string    `db:"parent_hash"`
	Timestamp   uint64    `db:"timestamp"`
	IsProcessed bool      `db:"is_processed"`
	CreatedAt   time.Time `db:"created_at"`
}

// ReorgModel provides base fields and methods for reorg handling
type ReorgModel struct {
	ID          int64  `db:"id" json:"id"`
	BlockNumber uint64 `db:"block_number" json:"block_number"`
	BlockHash   string `db:"block_hash" json:"block_hash"`
}