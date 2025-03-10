package processor

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"pdp-explorer-indexer/internal/logger"
	"pdp-explorer-indexer/internal/processor/handlers"
	"pdp-explorer-indexer/internal/types"

	"gopkg.in/yaml.v3"
)

type Trigger struct {
	Type       string `yaml:"Type"`       // "event" or "function"
	Definition string `yaml:"Definition"` // Event or function signature
	Handler    string `yaml:"Handler"`
	MethodName string `yaml:"MethodName"`
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

type Block struct {
	Logs         []*types.Log
	Transactions []*types.Transaction
}

// Processor handles the processing of blockchain events
type Processor struct {
	handlers           map[string]handlers.Handler
	contractMap        map[string]bool
	functionTriggerMap map[string]map[string]*Trigger
	eventTriggerMap    map[string]map[string]*Trigger
	mu                 sync.RWMutex
	workerPool         chan struct{} // semaphore for worker pool
	pendingTxManager   *PendingTransactionManager
}

// HandlerFactory is a map of handler names to their constructor functions
type HandlerFactory func(db handlers.Database, contractAddresses map[string]string, lotusAPIEndpoint string) handlers.Handler

var handlerRegistry = map[string]HandlerFactory{
	"ProofSetCreatedHandler": func(db handlers.Database, _ map[string]string, _ string) handlers.Handler {
		return handlers.NewProofSetCreatedHandler(db)
	},
	"ProofSetEmptyHandler": func(db handlers.Database, _ map[string]string, _ string) handlers.Handler {
		return handlers.NewProofSetEmptyHandler(db)
	},
	"ProofSetOwnerChangedHandler": func(db handlers.Database, _ map[string]string, _ string) handlers.Handler {
		return handlers.NewProofSetOwnerChangedHandler(db)
	},
	"ProofFeePaidHandler": func(db handlers.Database, _ map[string]string, _ string) handlers.Handler {
		return handlers.NewProofFeePaidHandler(db)
	},
	"ProofSetDeletedHandler": func(db handlers.Database, _ map[string]string, _ string) handlers.Handler {
		return handlers.NewProofSetDeletedHandler(db)
	},
	"RootsAddedHandler": func(db handlers.Database, _ map[string]string, _ string) handlers.Handler {
		return handlers.NewRootsAddedHandler(db)
	},
	"RootsRemovedHandler": func(db handlers.Database, _ map[string]string, _ string) handlers.Handler {
		return handlers.NewRootsRemovedHandler(db)
	},
	"NextProvingPeriodHandler": func(db handlers.Database, _ map[string]string, _ string) handlers.Handler {
		return handlers.NewNextProvingPeriodHandler(db)
	},
	"PossessionProvenHandler": func(db handlers.Database, _ map[string]string, _ string) handlers.Handler {
		return handlers.NewPossessionProvenHandler(db)
	},
	"FaultRecordHandler": func(db handlers.Database, contractAddresses map[string]string, lotusAPIEndpoint string) handlers.Handler {
		return handlers.NewFaultRecordHandler(db, contractAddresses["PDPVerifier"], lotusAPIEndpoint)
	},
	"TransactionHandler": func(db handlers.Database, _ map[string]string, _ string) handlers.Handler {
		return handlers.NewTransactionHandler(db)
	},
}

func RegisterHandlerFactory(name string, factory HandlerFactory) {
	handlerRegistry[name] = factory
}

// NewProcessor creates a new event processor with the given configuration file
func NewProcessor(configPath string, db handlers.Database, lotusAPIEndpoint string) (*Processor, error) {
	pConfig, err := loadConfig(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load config: %w", err)
	}

	p := &Processor{
		workerPool:         make(chan struct{}, runtime.NumCPU()), // limit concurrent workers to number of CPUs
		contractMap:        make(map[string]bool),
		functionTriggerMap: make(map[string]map[string]*Trigger),
		eventTriggerMap:    make(map[string]map[string]*Trigger),
		handlers:           make(map[string]handlers.Handler),
		pendingTxManager:   NewPendingTransactionManager(5), // retry up to 5 times
	}

	// Register handlers and initialize lookup maps
	p.registerHandlers(pConfig, db, lotusAPIEndpoint)

	return p, nil
}

func (p *Processor) registerHandlers(pConfig *Config, db handlers.Database, lotusAPIEndpoint string) {
	contractAddresses := make(map[string]string)
	for _, contract := range pConfig.Resources {
		contractAddresses[contract.Name] = contract.Address
	}

	// Register handlers for each event in each contract
	for i, contract := range pConfig.Resources {
		// Initialize contract map entry with lowercase address for O(1) lookups
		lowerAddr := strings.ToLower(contract.Address)
		p.contractMap[lowerAddr] = true

		// Initialize function and event trigger maps for this contract
		p.functionTriggerMap[lowerAddr] = make(map[string]*Trigger)
		p.eventTriggerMap[lowerAddr] = make(map[string]*Trigger)
		for j, trigger := range contract.Triggers {
			factory, exists := handlerRegistry[trigger.Handler]
			if !exists {
				logger.Warnf("Warning: No handler factory registered for %s", trigger.Handler)
				continue
			}

			handler := factory(db, contractAddresses, lotusAPIEndpoint)
			if handler == nil {
				logger.Warnf("Handler factory for %s returned nil", trigger.Handler)
				continue
			}
			// Add to appropriate lookup map based on trigger type
			triggerPtr := &pConfig.Resources[i].Triggers[j]
			if trigger.Type == handlers.HandlerTypeEvent {
				sig := GenerateEventSignature(trigger.Definition)
				lowerSig := strings.ToLower(sig)
				p.eventTriggerMap[lowerAddr][lowerSig] = triggerPtr
			} else if trigger.Type == handlers.HandlerTypeFunction {
				sig, methodName := GenerateFunctionSignature(trigger.Definition)

				if methodName != "" {
					triggerPtr.MethodName = methodName
				}
				lowerSig := strings.ToLower(sig)
				p.functionTriggerMap[lowerAddr][lowerSig] = triggerPtr
			} else {
				logger.Warnf("Unknown trigger type %s for %s", trigger.Type, trigger.Handler)
				continue
			}

			// Add handler to map
			p.handlers[trigger.Handler] = handler

			logger.Infof("Handler Registered: %s", trigger.Handler)
		}
	}
}

// GetContractAddresses returns all contract addresses from the processor's configuration
func (p *Processor) GetContractAddresses() map[string]bool {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.contractMap
}

// ProcessTransactions processes all transactions and logs from a block efficiently
func (p *Processor) ProcessTransactions(ctx context.Context, block *Block) error {
	if block == nil {
		return fmt.Errorf("block is nil")
	}

	// First process all transactions
	for _, tx := range block.Transactions {
		if tx == nil {
			continue
		}
		if err := p.processTransaction(ctx, tx); err != nil {
			if p.pendingTxManager.ShouldRetry(err) {
				logger.Warn(fmt.Sprintf("Transaction processed before corresponding event, adding to pending: %s", tx.Hash))
				p.pendingTxManager.AddPendingTransaction(tx)
				continue
			}
			return fmt.Errorf("failed to process transaction: %w", err)
		}
	}

	// Then process all logs with their associated transactions
	txMap := make(map[string]*types.Transaction)
	for _, tx := range block.Transactions {
		if tx != nil && tx.Hash != "" {
			txMap[tx.Hash] = tx
		}
	}

	for _, log := range block.Logs {
		if log == nil {
			continue
		}
		// Find associated transaction if it exists
		var tx *types.Transaction
		if log.TransactionHash != "" {
			tx = txMap[log.TransactionHash]
		}
		if err := p.processLog(ctx, log, tx); err != nil {
			return fmt.Errorf("failed to process event log: %w", err)
		}
	}

	// Process any pending transactions
	p.processPendingTransactions(ctx)

	return nil
}

// processTransaction processes a single transaction (internal method)
func (p *Processor) processTransaction(ctx context.Context, tx *types.Transaction) error {
	// Early check for function call before acquiring lock
	if len(tx.Input) < 10 { // "0x" + 8 hex chars (4 bytes)
		// Process logs first without function processing
		p.mu.RLock()
		for i := range tx.Logs {
			if err := p.processLog(ctx, &tx.Logs[i], tx); err != nil {
				p.mu.RUnlock()
				return err
			}
		}
		p.mu.RUnlock()
		return nil // Not a function call
	}

	// Normalize addresses and get function selector outside of lock
	toAddress := strings.ToLower(tx.To)
	functionSelector := strings.ToLower(tx.Input[:10]) // "0x" + first 4 bytes

	// Acquire read lock for map lookups and handler execution
	p.mu.RLock()
	defer p.mu.RUnlock()

	// Process logs with their associated transactions
	for i := range tx.Logs {
		if err := p.processLog(ctx, &tx.Logs[i], tx); err != nil {
			return err
		}
	}

	// Direct lookup using maps
	functionTriggers, contractExists := p.functionTriggerMap[toAddress]
	if !contractExists {
		return nil // No matching contract
	}

	matchedTrigger, triggerExists := functionTriggers[functionSelector]
	if !triggerExists {
		return nil // No matching function signature
	}

	// Get the handler
	handler, exists := p.handlers[matchedTrigger.Handler]
	if !exists {
		return fmt.Errorf("no handler registered for %s", matchedTrigger.Handler)
	}

	// Verify handler type
	if handler.GetType() != handlers.HandlerTypeFunction {
		return fmt.Errorf("handler %s is not a function handler", matchedTrigger.Handler)
	}

	// Process the function call
	tx.Method = matchedTrigger.MethodName
	return handler.HandleFunction(ctx, tx)
}

// processLog processes a single log (internal method)
func (p *Processor) processLog(ctx context.Context, eventLog *types.Log, tx *types.Transaction) error {
	// Check for nil eventLog
	if eventLog == nil {
		return fmt.Errorf("eventLog is nil")
	}

	// Early check for topics before doing any processing
	if len(eventLog.Topics) == 0 {
		return nil // No topics to process
	}

	// Normalize addresses - this can be done outside the lock
	contractAddress := strings.ToLower(eventLog.Address)

	// Direct lookup using maps
	eventTriggers, contractExists := p.eventTriggerMap[contractAddress]
	if !contractExists {
		return nil // No matching contract
	}

	matchedTrigger, triggerExists := eventTriggers[eventLog.Topics[0]]
	if !triggerExists {
		return nil // No matching event signature
	}

	// Get the handler
	handler, exists := p.handlers[matchedTrigger.Handler]
	if !exists {
		return fmt.Errorf("no handler registered for %s", matchedTrigger.Handler)
	}

	// Verify handler type
	if handler.GetType() != handlers.HandlerTypeEvent {
		return fmt.Errorf("handler %s is not an event handler", matchedTrigger.Handler)
	}

	// Process the event
	// Only set timestamp from transaction if it exists
	if tx != nil {
		eventLog.Timestamp = tx.Timestamp
	}

	err := handler.HandleEvent(ctx, eventLog, tx)
	if err != nil {
		// If the error indicates missing transaction, log it and continue
		if strings.Contains(err.Error(), "transaction is required") {
			logger.Warnf("Skipping event processing: %v", err)
			return nil
		}
		return fmt.Errorf("failed to process event log: %w", err)
	}
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

// Add method to process pending transactions
func (p *Processor) processPendingTransactions(ctx context.Context) {
	for _, pendingTx := range p.pendingTxManager.GetPendingTransactions() {
		// Skip if not enough time has passed since last attempt
		if time.Since(pendingTx.BlockTime) < time.Second*30 {
			continue
		}

		if err := p.processTransaction(ctx, pendingTx.Tx); err != nil {
			if p.pendingTxManager.ShouldRetry(err) {
				if !p.pendingTxManager.IncrementAttempts(pendingTx.Tx.Hash) {
					logger.Warn(fmt.Sprintf("Max retries reached for transaction %s", pendingTx.Tx.Hash))
					p.pendingTxManager.RemoveTransaction(pendingTx.Tx.Hash)
				}
				continue
			}
			logger.Error(fmt.Sprintf("Failed to process pending transaction %s", pendingTx.Tx.Hash), err)
			p.pendingTxManager.RemoveTransaction(pendingTx.Tx.Hash)
		} else {
			// Transaction processed successfully
			p.pendingTxManager.RemoveTransaction(pendingTx.Tx.Hash)
		}
	}
}
