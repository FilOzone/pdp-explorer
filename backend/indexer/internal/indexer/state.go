package indexer

import (
	"context"
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
	// TODO: Implement getting last processed block from database
	return 0, nil
}

func (i *Indexer) getCurrentBlockNumber(ctx context.Context) (uint64, error) {
	// TODO: Implement getting current block from blockchain
	return 0, nil
}
