package indexer

import (
	"fmt"

	_ "github.com/lib/pq"
)

func (i *Indexer) getLastBlock() uint64 {
	i.mutex.RLock()
	defer i.mutex.RUnlock()
	return i.lastBlock
}

func (i *Indexer) setLastBlock(block uint64) {
	i.mutex.Lock()
	defer i.mutex.Unlock()
	i.lastBlock = block
}

func (i *Indexer) getLastProcessedBlock() (uint64, error) {
	var height uint64
	err := i.db.QueryRow("SELECT COALESCE(MAX(height), 0) FROM blocks").Scan(&height)
	if err != nil {
		return 0, fmt.Errorf("failed to get last processed block: %w", err)
	}
	return height, nil
}
