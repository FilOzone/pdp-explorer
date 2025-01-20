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

type EventTrigger struct {
	Event   string `yaml:"Event"`
	Topic   string `yaml:"Topic"`
	Handler string `yaml:"Handler"`
}

// ContractConfig represents the configuration for a single contract
type ContractConfig struct {
	Name     string         `yaml:"Name"`
	Address  string         `yaml:"Address"`
	Triggers []EventTrigger `yaml:"Triggers"`
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
	Address string `json:"address"`
	Topics []string `json:"topics"`
	Data string `json:"data"`
	Removed bool `json:"removed"`
	LogIndex string `json:"log_index"`
	BlockNumber string `json:"block_number"`
	BlockHash string `json:"block_hash"`
	TransactionHash string `json:"transaction_hash"`
	TransactionIndex string `json:"transaction_index"`
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
			log.Printf("Registered handler %s for contract %s", trigger.Handler, contract.Name)
		}
	}

	// Log registered handlers
	var registeredHandlers []string
	for handlerName := range p.handlers {
		registeredHandlers = append(registeredHandlers, handlerName)
	}
	log.Printf("Total registered handlers: %d - %v", len(registeredHandlers), registeredHandlers)
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
		matchedTrigger  *EventTrigger
	)

	for _, contract := range p.config.Resources {
		// Skip if contract address doesn't match
		if contract.Address != "" && strings.ToLower(contract.Address) != logAddress {
			continue
		}

		// Look for matching event in contract's triggers
		for _, trigger := range contract.Triggers {
			if strings.ToLower(trigger.Topic) == topic0 {
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
			if trigger.Topic == "" {
				return nil, fmt.Errorf("trigger in contract %s missing topic", contract.Name)
			}
			if trigger.Handler == "" {
				return nil, fmt.Errorf("trigger in contract %s missing handler", contract.Name)
			}
			if trigger.Event == "" {
				return nil, fmt.Errorf("trigger in contract %s missing event", contract.Name)
			}
		}
	}

	return &config, nil
}