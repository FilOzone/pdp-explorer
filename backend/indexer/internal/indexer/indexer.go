package indexer

import (
	"context"
	"fmt"
	"log"
	"sync"

	"pdp-explorer-indexer/internal/client"
	"pdp-explorer-indexer/internal/config"
	"pdp-explorer-indexer/internal/infrastructure/database"
	"pdp-explorer-indexer/internal/processor"
)

type Indexer struct {
	db             *database.PostgresDB
	cfg            *config.ChainConfig
	lastBlock      uint64
	mutex          sync.RWMutex
	client         *client.Client
	processor *processor.Processor
	activeReorgs   map[uint64]*reorgState
	reorgMutex     sync.RWMutex
}

func NewIndexer(db *database.PostgresDB, cfg *config.ChainConfig) (*Indexer, error) {
	indexer := &Indexer{
		db:           db,
		cfg:          cfg,
		lastBlock:    cfg.StartBlock - 1,
		client:       client.NewClient(cfg.RPCEndpoint, cfg.APIKey),
		activeReorgs: make(map[uint64]*reorgState),
	}

	// Initialize event processor
	if err := indexer.InitEventProcessor(); err != nil {
		return nil, fmt.Errorf("failed to initialize event processor: %w", err)
	}

	return indexer, nil
}

func (i *Indexer) InitEventProcessor() error {
	var err error
	i.processor, err = processor.NewProcessor(i.cfg.EventsFilePath, i.db)
	if err != nil {
		return fmt.Errorf("failed to initialize event processor: %w", err)
	}
	return nil
}

// Start begins the indexing process
func (i *Indexer) Start(ctx context.Context) error {
	log.Printf("Starting indexer for chain %s (ID: %d)", 
		i.cfg.Name, i.cfg.ChainID)

	// Start the polling mechanism
	if err := i.startPolling(ctx); err != nil {
		return fmt.Errorf("failed to start polling: %w", err)
	}

	return nil
}
