package indexer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"

	"pdp-explorer-indexer/internal/infrastructure/config"
	"pdp-explorer-indexer/internal/infrastructure/database"
	"pdp-explorer-indexer/internal/processor"
)

type Indexer struct {
	db             *database.PostgresDB
	cfg            *config.Config
	lastBlock      uint64
	mutex          sync.RWMutex
	client         *http.Client
	eventProcessor *processor.EventProcessor
}

func NewIndexer(db *database.PostgresDB, cfg *config.Config) (*Indexer, error) {
	indexer := &Indexer{
		db:        db,
		cfg:       cfg,
		lastBlock: cfg.StartBlock - 1,
		client:    &http.Client{},
	}

	// Initialize event processor
	if err := indexer.InitEventProcessor(); err != nil {
		return nil, fmt.Errorf("failed to initialize event processor: %w", err)
	}

	return indexer, nil
}

func (i *Indexer) InitEventProcessor() error {
	var err error
	i.eventProcessor, err = processor.NewEventProcessor(i.cfg.EventsFilePath, i.db)
	if err != nil {
		return fmt.Errorf("failed to initialize event processor: %w", err)
	}
	return nil
}

// Helper method for JSON-RPC calls
func (i *Indexer) callRPC(method string, params interface{}, result interface{}) error {
	reqBody, err := json.Marshal(map[string]interface{}{
		"jsonrpc": "2.0",
		"method":  method,
		"params":  params,
		"id":      1,
	})
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	log.Printf("RPC Request to %s: Method=%s, Params=%+v", i.cfg.LotusAPIEndpoint, method, params)

	req, err := http.NewRequest("POST", i.cfg.LotusAPIEndpoint, bytes.NewReader(reqBody))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := i.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	// log.Printf("RPC Response: Status=%d, Body=%s", resp.StatusCode, string(body))

	var rpcResponse struct {
		Result json.RawMessage `json:"result"`
		Error  *struct {
			Message string `json:"message"`
		} `json:"error,omitempty"`
	}

	if err := json.Unmarshal(body, &rpcResponse); err != nil {
		return fmt.Errorf("failed to parse response: %w, body: %s", err, string(body))
	}

	if rpcResponse.Error != nil {
		return fmt.Errorf("RPC error: %s", rpcResponse.Error.Message)
	}

	return json.Unmarshal(rpcResponse.Result, result)
}

// Start begins the indexing process
func (i *Indexer) Start(ctx context.Context) error {
	log.Printf("Starting indexer with config: %+v", i.cfg)

	// Start the polling mechanism
	if err := i.startPolling(ctx); err != nil {
		return fmt.Errorf("failed to start polling: %w", err)
	}

	return nil
}
