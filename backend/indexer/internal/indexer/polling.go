package indexer

import (
	"context"
	"log"
	"time"
)

func (i *Indexer) startPolling(ctx context.Context) error {
	ticker := time.NewTicker(pollingInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			if err := i.processNewBlocks(ctx); err != nil {
				log.Printf("Error processing blocks: %v", err)
				continue
			}
		}
	}
}

func (i *Indexer) processNewBlocks(ctx context.Context) error {
	currentBlock, err := i.getCurrentBlockNumber(ctx)
	if err != nil {
		return err
	}

	if currentBlock <= blockConfirmations {
		return nil
	}
	safeBlock := currentBlock - blockConfirmations

	lastProcessed := i.getLastBlock()
	if safeBlock <= lastProcessed {
		return nil
	}

	return i.processBatch(ctx, lastProcessed+1, safeBlock)
}
