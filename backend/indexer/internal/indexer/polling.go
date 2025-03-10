package indexer

import (
	"context"
	"fmt"
	"time"

	"pdp-explorer-indexer/internal/logger"
)

const (
	minPollingInterval = 90 * time.Second
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
	} else if lastSyncedBlock > 0 {
		// Resuming from last synced block
		startBlock = uint64(lastSyncedBlock + 1)
	} else {
		// First time startup without configured start block
	}

	// Get current chain height
	currentHeight, err := i.getCurrentHeightWithRetries()
	if err != nil {
		return fmt.Errorf("failed to get current height: %w", err)
	}

	// If we're behind, start recovery process
	if startBlock > 0 && currentHeight > startBlock {
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

	// Start normal polling
	logger.Infof("Starting normal polling from height %d with interval %s", lastProcessedHeight+1, minPollingInterval)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			currentHeight, err := i.getCurrentHeightWithRetries()
			if err != nil {
				return fmt.Errorf("failed to get current height: %w", err)
			}

			// Skip if we've already processed this height
			if currentHeight <= lastProcessedHeight {
				logger.Debugf("Block %d already processed, waiting for new blocks...", currentHeight)
				continue
			}

			if currentHeight-lastProcessedHeight+1 > maxBlocksPerBatch {
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

			err = i.processBatch(ctx, lastProcessedHeight+1, currentHeight)
			if err != nil {
				return fmt.Errorf("failed to process batch: %w", err)
			}

			lastProcessedHeight = currentHeight
		}
	}
}

func (i *Indexer) recoverBlocks(ctx context.Context, startBlock, currentHeight uint64) error {
	logger.Infof("Syncing indexer from %d to %d", startBlock, currentHeight)
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

	logger.Infof("Sync complete. Processed %d blocks", blocksToRecover)
	return nil
}
