package indexer

import (
	"context"
	"log"
)

func (i *Indexer) processBatch(ctx context.Context, startBlock, safeBlock uint64) error {
	endBlock := safeBlock
	if endBlock-startBlock > maxBatchSize {
		endBlock = startBlock + maxBatchSize
	}

	log.Printf("Processing blocks from %d to %d", startBlock, endBlock)

	for blockNum := startBlock; blockNum <= endBlock; blockNum++ {
		if err := i.processBlock(ctx, blockNum); err != nil {
			return err
		}
		i.setLastBlock(blockNum)
	}

	return nil
}

func (i *Indexer) processBlock(ctx context.Context, blockNum uint64) error {
	// TODO: Implement block processing
	return nil
}
