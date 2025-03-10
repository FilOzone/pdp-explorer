package processor

import (
	"pdp-explorer-indexer/internal/types"
	"strings"
	"sync"
	"time"
)

// PendingTransaction represents a transaction that needs to be retried
type PendingTransaction struct {
	Tx        *types.Transaction
	Attempts  int
	BlockTime time.Time
}

// PendingTransactionManager handles retrying of failed transactions
type PendingTransactionManager struct {
	pendingTxs map[string]*PendingTransaction
	maxRetries int
	mu         sync.RWMutex
}

// NewPendingTransactionManager creates a new pending transaction manager
func NewPendingTransactionManager(maxRetries int) *PendingTransactionManager {
	return &PendingTransactionManager{
		pendingTxs: make(map[string]*PendingTransaction),
		maxRetries: maxRetries,
	}
}

// AddPendingTransaction adds a transaction to the pending list
func (m *PendingTransactionManager) AddPendingTransaction(tx *types.Transaction) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.pendingTxs[tx.Hash] = &PendingTransaction{
		Tx:        tx,
		Attempts:  1,
		BlockTime: time.Now(),
	}
}

// GetPendingTransactions returns all pending transactions
func (m *PendingTransactionManager) GetPendingTransactions() []*PendingTransaction {
	m.mu.RLock()
	defer m.mu.RUnlock()

	txs := make([]*PendingTransaction, 0, len(m.pendingTxs))
	for _, tx := range m.pendingTxs {
		txs = append(txs, tx)
	}
	return txs
}

// RemoveTransaction removes a transaction from the pending list
func (m *PendingTransactionManager) RemoveTransaction(hash string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.pendingTxs, hash)
}

// IncrementAttempts increments the attempt counter for a transaction
func (m *PendingTransactionManager) IncrementAttempts(hash string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()

	if tx, exists := m.pendingTxs[hash]; exists {
		tx.Attempts++
		tx.BlockTime = time.Now()
		return tx.Attempts < m.maxRetries
	}
	return false
}

// ShouldRetry checks if a transaction should be retried based on its error
func (m *PendingTransactionManager) ShouldRetry(err error) bool {
	return err != nil && strings.Contains(err.Error(), "root not found")
}
