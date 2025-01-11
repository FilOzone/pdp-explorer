package indexer

import (
	"context"
	"fmt"
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

func (i *Indexer) getCurrentBlockNumber(ctx context.Context) (uint64, error) {
	var result struct {
		Height uint64 `json:"Height"`
		Blocks []struct {
			Height uint64 `json:"Height"`
		} `json:"Blocks"`
	}
	err := i.callRPC("Filecoin.ChainHead", nil, &result)
	if err != nil {
		return 0, fmt.Errorf("failed to get chain head: %w", err)
	}

	if result.Height == 0 && len(result.Blocks) > 0 {
		result.Height = result.Blocks[0].Height
	}

	if result.Height == 0 {
		return 0, fmt.Errorf("lotus node returned height 0, check if node is synced")
	}

	log.Printf("Current chain height: %d", result.Height)
	return result.Height, nil
}
