package processor

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"

	"gopkg.in/yaml.v3"
)

type Trigger struct {
	Type       string `yaml:"Type"`       // "event" or "function"
	Definition string `yaml:"Definition"` // Event or function definition
	Handler    string `yaml:"Handler"`
}

type ContractConfig struct {
	Name     string    `yaml:"Name"`
	Address  string    `yaml:"Address"`
	Triggers []Trigger `yaml:"Triggers"`
}

// Config represents the event configuration loaded from events.yaml
type Config struct {
	Resources []ContractConfig `yaml:"Resources"`
}

// EventProcessor handles the processing of blockchain events
type EventProcessor struct {
	config     *Config
	handlers   map[string]EventHandler
	mu         sync.RWMutex
	workerPool chan struct{} // semaphore for worker pool
}

// EventHandler is the interface that must be implemented by event handlers
type EventHandler interface {
	Handle(ctx context.Context, log Log) error
}

// Log represents a blockchain event log
type Log struct {
	Address          string   `json:"address"`
	Topics           []string `json:"topics"`
	Data             string   `json:"data"`
	Removed          bool     `json:"removed"`
	LogIndex         string   `json:"log_index"`
	BlockNumber      string   `json:"block_number"`
	BlockHash        string   `json:"block_hash"`
	TransactionHash  string   `json:"transaction_hash"`
	TransactionIndex string   `json:"transaction_index"`
	From             string   `json:"from"`
	To               string   `json:"to"`
}

// Transaction represents a blockchain transaction
type Transaction struct {
	Hash        string `json:"hash"`
	To          string `json:"to"`
	From        string `json:"from"`
	Input       string `json:"input"` // Function call data
	Value       string `json:"value"`
	BlockHash   string `json:"blockHash"`
	BlockNumber string `json:"blockNumber"`
}

// HandlerFactory is a map of handler names to their constructor functions
type HandlerFactory func(db Database) EventHandler

var handlerRegistry = map[string]HandlerFactory{
	"ProofSetCreatedHandler": func(db Database) EventHandler { return NewProofSetCreatedHandler(db) },
	"ProofSetDeletedHandler": func(db Database) EventHandler { return NewProofSetDeletedHandler(db) },
	"RootsAddedHandler":      func(db Database) EventHandler { return NewRootsAddedHandler(db) },
	"RootsRemovedHandler":    func(db Database) EventHandler { return NewRootsRemovedHandler(db) },
	"ProofFeePaidHandler":    func(db Database) EventHandler { return NewProofFeePaidHandler(db) },
	"ProofSetEmptyHandler":   func(db Database) EventHandler { return NewProofSetEmptyHandler(db) },
	"FaultRecordHandler":     func(db Database) EventHandler { return NewFaultRecordHandler(db) },
	"TransferHandler":        func(db Database) EventHandler { return NewTransferHandler(db) },
	"WithdrawFunctionHandler": func(db Database) EventHandler { return NewWithdrawFunctionHandler(db) },
}

// RegisterHandlerFactory registers a new handler factory
func RegisterHandlerFactory(name string, factory HandlerFactory) {
	handlerRegistry[name] = factory
}

// NewEventProcessor creates a new event processor with the given configuration file
func NewEventProcessor(configPath string, db Database) (*EventProcessor, error) {
	config, err := loadConfig(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load config: %w", err)
	}

	p := &EventProcessor{
		config:     config,
		workerPool: make(chan struct{}, runtime.NumCPU()), // limit concurrent workers to number of CPUs
	}
	p.registerHandlers(db)

	return p, nil
}

func (p *EventProcessor) registerHandlers(db Database) {
	p.handlers = make(map[string]EventHandler)

	// Register handlers for each event in each contract
	for _, contract := range p.config.Resources {
		for _, trigger := range contract.Triggers {
			factory, exists := handlerRegistry[trigger.Handler]
			if !exists {
				log.Printf("Warning: No handler factory registered for %s", trigger.Handler)
				continue
			}

			handler := factory(db)
			if handler == nil {
				log.Printf("Warning: Handler factory for %s returned nil", trigger.Handler)
				continue
			}

			p.handlers[trigger.Handler] = handler
		}
	}

	// Log registered handlers
	var registeredHandlers []string
	for handlerName := range p.handlers {
		registeredHandlers = append(registeredHandlers, handlerName)
	}

}

// ProcessLogs processes multiple logs using a worker pool
func (p *EventProcessor) ProcessLogs(ctx context.Context, eventLogs []Log) error {
	if len(eventLogs) == 0 {
		return nil
	}

	var wg sync.WaitGroup
	errChan := make(chan error, len(eventLogs))

	// Process logs using worker pool
	for _, eventLog := range eventLogs {
		wg.Add(1)
		go func(l Log) {
			defer wg.Done()

			// Acquire worker from pool
			select {
			case p.workerPool <- struct{}{}: // acquire worker
				defer func() { <-p.workerPool }() // release worker
			case <-ctx.Done():
				errChan <- ctx.Err()
				return
			}

			if err := p.processLog(ctx, l); err != nil {
				select {
				case errChan <- fmt.Errorf("failed to process log: %w", err):
				default:
					log.Printf("Error channel full, dropping error: %v", err)
				}
			}
		}(eventLog)
	}

	// Close error channel when all workers complete
	go func() {
		wg.Wait()
		close(errChan)
	}()

	// Collect any errors
	var errs []error
	for err := range errChan {
		errs = append(errs, err)
	}

	// If there were any errors, return them combined
	if len(errs) > 0 {
		return fmt.Errorf("errors processing logs: %v", errs)
	}

	return nil
}

// processLog processes a single log (internal method)
func (p *EventProcessor) processLog(ctx context.Context, eventLog Log) error {
	p.mu.RLock()
	defer p.mu.RUnlock()

	if len(eventLog.Topics) == 0 {
		return fmt.Errorf("log has no topics")
	}

	// Normalize addresses for comparison
	logAddress := strings.ToLower(eventLog.Address)
	topic0 := strings.ToLower(eventLog.Topics[0])

	// Find matching contract and event configuration
	var (
		matchedContract *ContractConfig
		matchedTrigger  *Trigger
	)

	for _, contract := range p.config.Resources {
		if contract.Address != "" && strings.ToLower(contract.Address) != logAddress {
			continue
		}

		for _, trigger := range contract.Triggers {
			if trigger.Type != "event" {
				continue
			}

			// Generate event signature and compare
			eventSig := GenerateEventSignature(trigger.Definition)
			if strings.ToLower(eventSig) == topic0 {
				matchedContract = &contract
				matchedTrigger = &trigger
				break
			}
		}
		if matchedTrigger != nil {
			break
		}
	}

	if matchedTrigger == nil {
		return fmt.Errorf("no matching event configuration found for address: %s and topic: %s", logAddress, topic0)
	}

	// Get the handler for this event
	handler, exists := p.handlers[matchedTrigger.Handler]
	if !exists {
		return fmt.Errorf("no handler registered for event: %s", matchedTrigger.Handler)
	}

	// Handle the event
	if err := handler.Handle(ctx, eventLog); err != nil {
		return fmt.Errorf("handler failed: %w", err)
	}

	log.Printf("Successfully processed %s event from contract %s tx: %s", matchedTrigger.Handler, matchedContract.Name, eventLog.TransactionHash)

	return nil
}

// ProcessTransactions processes multiple transactions using a worker pool
func (p *EventProcessor) ProcessTransactions(ctx context.Context, txs []Transaction) error {
	if len(txs) == 0 {
		return nil
	}

	var wg sync.WaitGroup
	errChan := make(chan error, len(txs))

	for _, tx := range txs {
		wg.Add(1)
		go func(t Transaction) {
			defer wg.Done()

			select {
			case p.workerPool <- struct{}{}:
				defer func() { <-p.workerPool }()
			case <-ctx.Done():
				errChan <- ctx.Err()
				return
			}

			if err := p.processTransaction(ctx, t); err != nil {
				select {
				case errChan <- fmt.Errorf("failed to process transaction: %w", err):
				default:
					log.Printf("Error channel full, dropping error: %v", err)
				}
			}
		}(tx)
	}

	go func() {
		wg.Wait()
		close(errChan)
	}()

	var errs []error
	for err := range errChan {
		errs = append(errs, err)
	}

	if len(errs) > 0 {
		return fmt.Errorf("errors processing transactions: %v", errs)
	}

	return nil
}

// processTransaction processes a single transaction (internal method)
func (p *EventProcessor) processTransaction(ctx context.Context, tx Transaction) error {
	p.mu.RLock()
	defer p.mu.RUnlock()

	if len(tx.Input) < 10 { // "0x" + 8 hex chars (4 bytes)
		return nil // Not a function call
	}

	// Normalize addresses and get function selector
	toAddress := strings.ToLower(tx.To)
	functionSelector := strings.ToLower(tx.Input[:10]) // "0x" + first 4 bytes

	// Find matching contract and function configuration
	var (
		matchedContract *ContractConfig
		matchedTrigger  *Trigger
	)

	for _, contract := range p.config.Resources {
		// Skip if contract address doesn't match
		if contract.Address != "" && strings.ToLower(contract.Address) != toAddress {
			continue
		}

		// Look for matching function in contract's triggers
		for _, trigger := range contract.Triggers {
			if trigger.Type != "function" {
				continue
			}

			// Generate function signature and compare
			funcSig := GenerateFunctionSignature(trigger.Definition)
			log.Printf("Checking trigger %s with function signature %s with function selector %s", trigger.Handler, funcSig, functionSelector)
			if strings.ToLower(funcSig) == functionSelector {
				matchedContract = &contract
				matchedTrigger = &trigger
				break
			}
		}
		if matchedTrigger != nil {
			break
		}
	}

	if matchedTrigger == nil {
		log.Printf("No matching function trigger found for tx %s", tx.Hash)
		return nil // No matching function trigger found
	}

	// Get the handler for this function
	handler, exists := p.handlers[matchedTrigger.Handler]
	if !exists {
		return fmt.Errorf("no handler registered for function: %s", matchedTrigger.Handler)
	}

	// Create a Log-like structure for compatibility with existing handlers
	functionLog := Log{
		Address:         tx.To,
		Data:            tx.Input[10:], // Remove function selector
		BlockHash:       tx.BlockHash,
		BlockNumber:     tx.BlockNumber,
		TransactionHash: tx.Hash,
	}

	// Handle the function call
	if err := handler.Handle(ctx, functionLog); err != nil {
		return fmt.Errorf("handler failed: %w", err)
	}

	log.Printf("Successfully processed %s function call from contract %s tx: %s",
		matchedTrigger.Handler, matchedContract.Name, tx.Hash)

	return nil
}

func (p *EventProcessor) ProcessTransaction(ctx context.Context, tx Transaction) error {
	return p.processTransaction(ctx, tx)
}

// loadConfig loads the event configuration from the YAML file
func loadConfig(configPath string) (*Config, error) {
	absPath, err := filepath.Abs(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to get absolute path: %w", err)
	}

	data, err := os.ReadFile(absPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var config Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	// Validate the configuration
	if len(config.Resources) == 0 {
		return nil, fmt.Errorf("no resources defined in config")
	}

	for _, contract := range config.Resources {
		if contract.Name == "" {
			return nil, fmt.Errorf("contract missing name")
		}

		if len(contract.Triggers) == 0 {
			return nil, fmt.Errorf("contract %s has no triggers", contract.Name)
		}

		for _, trigger := range contract.Triggers {
			if trigger.Definition == "" {
				return nil, fmt.Errorf("trigger in contract %s missing definition", contract.Name)
			}
			if trigger.Handler == "" {
				return nil, fmt.Errorf("trigger in contract %s missing handler", contract.Name)
			}
		}
	}

	return &config, nil
}
