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

	"pdp-explorer-indexer/internal/processor/handlers"
	"pdp-explorer-indexer/internal/types"

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

// Processor handles the processing of blockchain events
type Processor struct {
	config     *Config
	handlers   map[string]types.Handler
	mu         sync.RWMutex
	workerPool chan struct{} // semaphore for worker pool
}

// HandlerFactory is a map of handler names to their constructor functions
type HandlerFactory func(db handlers.Database) types.Handler

var handlerRegistry = map[string]HandlerFactory{
	"ProofSetCreatedHandler":       func(db handlers.Database) types.Handler { return handlers.NewProofSetCreatedHandler(db) },
	"ProofSetEmptyHandler":         func(db handlers.Database) types.Handler { return handlers.NewProofSetEmptyHandler(db) },
	"ProofSetOwnerChangedHandler": func(db handlers.Database) types.Handler { return handlers.NewProofSetOwnerChangedHandler(db) },
	"ProofFeePaidHandler":         func(db handlers.Database) types.Handler { return handlers.NewProofFeePaidHandler(db) },
	"ProofSetDeletedHandler":      func(db handlers.Database) types.Handler { return handlers.NewProofSetDeletedHandler(db) },
	"RootsAddedHandler":           func(db handlers.Database) types.Handler { return handlers.NewRootsAddedHandler(db) },
	"RootsRemovedHandler":         func(db handlers.Database) types.Handler { return handlers.NewRootsRemovedHandler(db) },
	"NextProvingPeriodHandler":    func(db handlers.Database) types.Handler { return handlers.NewNextProvingPeriodHandler(db) },
	"PossessionProvenHandler":     func(db handlers.Database) types.Handler { return handlers.NewPossessionProvenHandler(db) },
	"FaultRecordHandler":          func(db handlers.Database) types.Handler { return handlers.NewFaultRecordHandler(db) },
}

func RegisterHandlerFactory(name string, factory HandlerFactory) {
	handlerRegistry[name] = factory
}

// NewProcessor creates a new event processor with the given configuration file
func NewProcessor(configPath string, db handlers.Database) (*Processor, error) {
	config, err := loadConfig(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load config: %w", err)
	}

	p := &Processor{
		config:     config,
		workerPool: make(chan struct{}, runtime.NumCPU()), // limit concurrent workers to number of CPUs
	}
	p.registerHandlers(db)

	return p, nil
}

func (p *Processor) registerHandlers(db handlers.Database) {
	p.handlers = make(map[string]types.Handler)

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
	log.Printf("Registered handlers: %v", registeredHandlers)
}

// Get config's contract Addresses
func (p *Config) GetContractAddresses() []string {
	var contractAddresses []string
	for _, contract := range p.Resources {
		contractAddresses = append(contractAddresses, contract.Address)
	}
	return contractAddresses
}

// GetContractAddresses returns all contract addresses from the processor's configuration
func (p *Processor) GetContractAddresses() []string {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.config.GetContractAddresses()
}

// ProcessBlockData processes all transactions and logs from a block efficiently
func (p *Processor) ProcessBlockData(ctx context.Context, data types.BlockData) error {
	if len(data.Transactions) == 0 && len(data.Logs) == 0 {
		return nil
	}

	// Build transaction map for quick lookups
	txMap := make(map[string]*types.Transaction)
	for i := range data.Transactions {
		tx := &data.Transactions[i]
		txMap[tx.Hash] = tx
	}

	// Create wait group and error channel for all goroutines
	var wg sync.WaitGroup
	errChan := make(chan error, len(data.Transactions)+len(data.Logs))

	// Process transactions
	for i := range data.Transactions {
		tx := &data.Transactions[i]
		wg.Add(1)
		go func(t *types.Transaction) {
			defer wg.Done()

			select {
			case p.workerPool <- struct{}{}:
				defer func() { <-p.workerPool }()
			case <-ctx.Done():
				errChan <- ctx.Err()
				return
			}

			if err := p.processTransaction(ctx, *t); err != nil {
				select {
				case errChan <- fmt.Errorf("failed to process transaction %s: %w", t.Hash, err):
				default:
					log.Printf("Error channel full, dropping error: %v", err)
				}
			}
		}(tx)
	}

	// Process logs with their associated transactions
	for i := range data.Logs {
		eventLog := data.Logs[i]
		wg.Add(1)
		go func(l types.Log) {
			defer wg.Done()

			select {
			case p.workerPool <- struct{}{}:
				defer func() { <-p.workerPool }()
			case <-ctx.Done():
				errChan <- ctx.Err()
				return
			}

			tx := txMap[l.TransactionHash]
			if err := p.processLog(ctx, l, tx); err != nil {
				select {
				case errChan <- fmt.Errorf("failed to process log from tx %s: %w", l.TransactionHash, err):
				default:
					log.Printf("Error channel full, dropping error: %v", err)
				}
			}
		}(eventLog)
	}

	// Wait for all processing to complete
	go func() {
		wg.Wait()
		close(errChan)
	}()

	// Collect any errors
	var errs []error
	for err := range errChan {
		errs = append(errs, err)
	}

	if len(errs) > 0 {
		return fmt.Errorf("errors processing block data: %v", errs)
	}

	return nil
}

// processTransaction processes a single transaction (internal method)
func (p *Processor) processTransaction(ctx context.Context, tx types.Transaction) error {
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
		if strings.EqualFold(contract.Address, toAddress) {
			matchedContract = &contract
			for _, trigger := range contract.Triggers {
				// Generate function signature
				funcSig := GenerateFunctionSignature(trigger.Definition)
				if trigger.Type == types.HandlerTypeFunction && strings.EqualFold(funcSig, functionSelector) {
					matchedTrigger = &trigger
					break
				}
			}
			break
		}
	}

	if matchedContract == nil || matchedTrigger == nil {
		return nil // No matching contract or function
	}

	// Get the handler
	handler, exists := p.handlers[matchedTrigger.Handler]
	if !exists {
		return fmt.Errorf("no handler registered for %s", matchedTrigger.Handler)
	}

	// Verify handler type
	if handler.GetType() != types.HandlerTypeFunction {
		return fmt.Errorf("handler %s is not a function handler", matchedTrigger.Handler)
	}

	// Process the function call
	return handler.HandleFunction(ctx, tx)
}

// processLog processes a single log (internal method)
func (p *Processor) processLog(ctx context.Context, eventLog types.Log, tx *types.Transaction) error {
	p.mu.RLock()
	defer p.mu.RUnlock()

	// Normalize addresses
	contractAddress := strings.ToLower(eventLog.Address)

	// Find matching contract and event configuration
	var (
		matchedContract *ContractConfig
		matchedTrigger  *Trigger
	)

	for _, contract := range p.config.Resources {
		if strings.EqualFold(contract.Address, contractAddress) {
			matchedContract = &contract
			for _, trigger := range contract.Triggers {
				// Generate event signature
				eventSig := GenerateEventSignature(trigger.Definition)
				if trigger.Type == types.HandlerTypeEvent && strings.EqualFold(eventSig, eventLog.Topics[0]) {
					matchedTrigger = &trigger
					break
				}
			}
			break
		}
	}

	if matchedContract == nil || matchedTrigger == nil {
		return nil // No matching contract or event
	}

	// Get the handler
	handler, exists := p.handlers[matchedTrigger.Handler]
	if !exists {
		return fmt.Errorf("no handler registered for %s", matchedTrigger.Handler)
	}

	// Verify handler type
	if handler.GetType() != types.HandlerTypeEvent {
		return fmt.Errorf("handler %s is not an event handler", matchedTrigger.Handler)
	}

	// Process the event
	return handler.HandleEvent(ctx, eventLog, tx)
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
