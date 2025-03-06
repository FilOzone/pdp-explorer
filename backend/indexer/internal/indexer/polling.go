package indexer

import (
	"context"
	"fmt"
	"log"
	"time"
)

const (
	minPollingInterval = 120 * time.Second
	maxPollingInterval = 5 * time.Minute
	maxRetries         = 3
	maxBlocksPerBatch  = 5 // Maximum number of blocks to process in one batch
)

func (i *Indexer) startPolling(ctx context.Context) error {
	ticker := time.NewTicker(minPollingInterval)
	defer ticker.Stop()

	// Get the last synced block from database
	lastSyncedBlock, err := i.db.GetLastProcessedBlock(ctx)
	if err != nil {
		return fmt.Errorf("failed to get last synced block: %w", err)
	}

	// Determine starting block
	var startBlock uint64
	if lastSyncedBlock == 0 && i.cfg.StartBlock > 0 {
		// First time startup with configured start block
		startBlock = i.cfg.StartBlock
		log.Printf("First time startup, starting from configured block: %d", startBlock)
	} else if lastSyncedBlock > 0 {
		// Resuming from last synced block
		startBlock = uint64(lastSyncedBlock + 1)
		log.Printf("Resuming from last synced block: %d", lastSyncedBlock)
	} else {
		// First time startup without configured start block
		log.Printf("No start block configured and no previous sync state, starting from current height")
	}

	// Get current chain height
	currentHeight, err := i.getCurrentHeightWithRetries()
	if err != nil {
		return fmt.Errorf("failed to get current height: %w", err)
	}

	// If we're behind, start recovery process
	if startBlock > 0 && currentHeight > startBlock {
		log.Printf("Current height (%d) is ahead of start block (%d), starting recovery...", currentHeight, startBlock)
		if err := i.recoverBlocks(ctx, startBlock, currentHeight); err != nil {
			return fmt.Errorf("failed to recover blocks: %w", err)
		}
		startBlock = currentHeight + 1
	}

	// Set initial last processed height
	var lastProcessedHeight uint64
	if startBlock > 0 {
		lastProcessedHeight = startBlock - 1
	} else {
		lastProcessedHeight = currentHeight
	}

	log.Printf("Starting normal polling from height %d", lastProcessedHeight + 1)

	// Start normal polling
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			currentHeight, err := i.getCurrentHeightWithRetries()
			if err != nil {
				log.Printf("Error getting current height: %v", err)
				continue
			}

			// Skip if we've already processed this height
			if currentHeight <= lastProcessedHeight {
				log.Printf("Block %d already processed, waiting for new blocks...", currentHeight)
				continue
			}

			if currentHeight - lastProcessedHeight + 1 > maxBlocksPerBatch {
				// Process blocks in batches
				for start := lastProcessedHeight + 1; start <= currentHeight; start += maxBlocksPerBatch + 1 {
					select {
					case <-ctx.Done():
						return ctx.Err()
					default:
						err := i.processBatch(ctx, start, min(start+maxBlocksPerBatch-1, currentHeight))
						if err != nil {
							return fmt.Errorf("failed to process batch: %w", err)
						}
					}
				}

				lastProcessedHeight = currentHeight
				continue
			}

			err = i.processBatch(ctx, lastProcessedHeight + 1, currentHeight)
			if err != nil {
				log.Printf("Error processing batch: %v", err)
				continue
			}

			lastProcessedHeight = currentHeight
		}
	}
}

func (i *Indexer) recoverBlocks(ctx context.Context, startBlock, currentHeight uint64) error {
	log.Printf("Starting recovery process. Last synced: %d, Current height: %d", startBlock - 1, currentHeight)

	// Calculate total blocks to recover
	blocksToRecover := currentHeight - startBlock + 1

	// Process blocks in batches
	for start := startBlock; start <= currentHeight; start += maxBlocksPerBatch {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			err := i.processBatch(ctx, start, min(start+maxBlocksPerBatch-1, currentHeight))
			if err != nil {
				return fmt.Errorf("failed to process batch: %w", err)
			}
		}
	}

	log.Printf("Recovery complete. Processed %d blocks", blocksToRecover)
	return nil
}

