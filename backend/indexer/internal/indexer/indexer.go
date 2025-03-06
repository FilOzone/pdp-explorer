package indexer

import (
	"context"
	"fmt"
	"sync"

	"pdp-explorer-indexer/internal/client"
	"pdp-explorer-indexer/internal/infrastructure/config"
	"pdp-explorer-indexer/internal/infrastructure/database"
	"pdp-explorer-indexer/internal/logger"
	"pdp-explorer-indexer/internal/processor"
)

type Indexer struct {
	db             *database.PostgresDB
	cfg            *config.Config
	client         *client.Client
	processor *processor.Processor
	activeReorgs   map[uint64]*reorgState
	reorgMutex     sync.RWMutex
}

func NewIndexer(db *database.PostgresDB, cfg *config.Config) (*Indexer, error) {
	indexer := &Indexer{
		db:           db,
		cfg:          cfg,
		client:       client.NewClient(cfg.LotusAPIEndpoint, cfg.LotusAPIKey),
		activeReorgs: make(map[uint64]*reorgState),
	}

	// Initialize event processor
	if err := indexer.InitEventProcessor(); err != nil {
		logger.Error("Failed to initialize event processor", err)
		return nil, fmt.Errorf("failed to initialize event processor: %w", err)
	}

	return indexer, nil
}

func (i *Indexer) InitEventProcessor() error {
	var err error
	i.processor, err = processor.NewProcessor(i.cfg.TriggersConfig, i.db, i.cfg.LotusAPIEndpoint)
	if err != nil {
		logger.Error("Failed to initialize event processor", err)
		return fmt.Errorf("failed to initialize event processor: %w", err)
	}
	return nil
}

// Start begins the indexing process
func (i *Indexer) Start(ctx context.Context) error {
	// Start the polling mechanism
	if err := i.startPolling(ctx); err != nil {
		logger.Error("Failed to start polling", err)
		return fmt.Errorf("failed to start polling: %w", err)
	}

	return nil
}
