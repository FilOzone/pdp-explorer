package indexer

import (
	"context"
	"sync"
	"time"

	"pdp-explorer-indexer/internal/infrastructure/config"
	"pdp-explorer-indexer/internal/infrastructure/database"
)

const (
	blockConfirmations = 12 // Number of block confirmations to wait
	pollingInterval    = 15 * time.Second
	maxBatchSize       = 100 // Maximum blocks to process in one batch
)

type Indexer struct {
	db        *database.PostgresDB
	cfg       *config.Config
	lastBlock uint64
	mutex     sync.RWMutex
}

func NewIndexer(db *database.PostgresDB, cfg *config.Config) *Indexer {
	return &Indexer{
		db:  db,
		cfg: cfg,
	}
}

func (i *Indexer) Start(ctx context.Context) error {
	lastBlock, err := i.getLastProcessedBlock()
	if err != nil {
		return err
	}
	i.setLastBlock(lastBlock)

	return i.startPolling(ctx)
}
