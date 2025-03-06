package indexer

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"

	"pdp-explorer-indexer/internal/models"
	"pdp-explorer-indexer/internal/types"
)

type ContractConfig struct {
	Name     string    `yaml:"Name"`
	Address  string    `yaml:"Address"`
	Triggers []Trigger `yaml:"Triggers"`
}

type Trigger struct {
	Type       string `yaml:"Type"`
	Definition string `yaml:"Definition"`
	Handler    string `yaml:"Handler"`
}

type reorgState struct {
	startHeight uint64
	endHeight   uint64
	startTime   time.Time
	cancel      context.CancelFunc
}

const (
	blockFinalizationDepth = uint64(900) // Number of blocks needed for finalization
	cleanupInterval        = uint64(100) // Run cleanup every N blocks
	maxTxsPerBatch         = uint64(40) // Max number of transactions per batch
)

func (i *Indexer) processBatch(ctx context.Context, startBlock, endBlock uint64) error {
	log.Printf("Processing blocks from %d to %d (batch size: %d)",
		startBlock, endBlock, endBlock-startBlock+1)

	processed := 0

	blocks, err := i.getBlocksWithTransactions(startBlock, endBlock, true)
	if err != nil {
		return err
	}
	for _, block := range blocks {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		// Get block with transactions
		blockNum, err := strconv.ParseUint(block.Number, 0, 64)
		if err != nil {
			// escape null epoch blocks
			if strings.Contains(err.Error(), fmt.Sprintf("requested epoch was a null round (%d)", blockNum)) {
				processed++
				continue
			}
			return fmt.Errorf("failed to get block: %w", err)
		}

		timestamp, err := strconv.ParseUint(block.Timestamp, 0, 64)
		if err != nil {
			log.Printf("failed to parse timestamp: %v", err)
		}

		blockToSave := models.Block{
			Height:      int64(blockNum),
			Hash:        block.Hash,
			ParentHash:  block.ParentHash,
			IsProcessed: false,
			Timestamp:   timestamp,
		}
		if err := i.db.SaveBlock(ctx, &blockToSave); err != nil {
			return fmt.Errorf("failed to save block: %w", err)
		}

		blockInfo := toBlockInfo(block, true)
		isReorg, reorgDepth, err := i.detectReorg(ctx, blockNum, blockInfo)
		if err != nil {
			return fmt.Errorf("failed to detect reorg: %w", err)
		}

		if isReorg {
			reorgStartBlock := blockNum - reorgDepth
			log.Printf("Reorg detected at block %d with depth %d", blockNum, reorgDepth)

			// Try to start reorg handling
			reorgCtx, started := i.tryStartReorg(ctx, reorgStartBlock, blockNum)
			if !started {
				// Skip this block and continue with the next one
				continue
			}

			// Run reconciliation with timeout context
			err := i.reconcile(reorgCtx, reorgStartBlock, blockNum)
			i.finishReorg(reorgStartBlock) // Always clean up

			if err != nil {
				if errors.Is(err, context.DeadlineExceeded) {
					log.Printf("Reorg handling timed out for block range %d-%d", reorgStartBlock, blockNum)
					continue // Skip this block on timeout
				}
				return fmt.Errorf("failed to handle reorg: %w", err)
			}
		}

		if err := i.processTipset(ctx, block); err != nil {
			return err
		}

		// Run cleanup for finalized blocks periodically
		if blockNum%cleanupInterval == 0 {
			if err := i.cleanupFinalizedData(ctx, blockNum); err != nil {
				log.Printf("Warning: Failed to cleanup finalized data at block %d: %v", blockNum, err)
			}
		}

		if err := i.db.UpdateBlockProcessingState(ctx, int64(blockNum), true); err != nil {
			log.Printf("Error updating sync state for block %d: %v", blockNum, err)
			continue
		}
		
		processed++
	}

	log.Printf("Successfully processed %d blocks from %d to %d",
		processed, startBlock, endBlock)
	return nil
}

func (ind *Indexer) processTipset(ctx context.Context, block *types.EthBlock) error {
	if block == nil {
		return fmt.Errorf("block is nil")
	}

	blockTimestamp, err := strconv.ParseInt(block.Timestamp, 0, 64)
	if err != nil {
		return fmt.Errorf("failed to parse block timestamp: %w", err)
	}

	// Collect transactions that need receipts
	var txsNeedingReceipts []types.Transaction
	contractMap := ind.processor.GetContractAddresses()

	for _, txOrHash := range block.Transactions {
		if txOrHash.To != "" {
			lowerTo := strings.ToLower(txOrHash.To)
			if contractMap[lowerTo] {
				txsNeedingReceipts = append(txsNeedingReceipts, txOrHash.Transaction)
			}
		}
	}

	if len(txsNeedingReceipts) == 0 {
		return nil
	}

	// Process transactions in batches of 50
	const batchSize = int(maxTxsPerBatch / 2)
	type receiptResult struct {
		receipt types.TransactionReceipt
		txHash  string
		tx      types.Transaction
		err     error
	}
	results := make(chan receiptResult, len(txsNeedingReceipts))

	var wg sync.WaitGroup
	for i := 0; i < len(txsNeedingReceipts); i += batchSize {
		end := i + batchSize
		if end > len(txsNeedingReceipts) {
			end = len(txsNeedingReceipts)
		}

		batch := txsNeedingReceipts[i:end]
		hashes := make([]string, len(batch))
		for j, tx := range batch {
			hashes[j] = tx.Hash
		}

		wg.Add(1)
		go func(txBatch []types.Transaction, txHashes []string) {
			defer wg.Done()
			receipts, err := ind.getTransactionsReceipts(txHashes)
			if err != nil {
				// If batch request fails, send error for each transaction
				for _, tx := range txBatch {
					results <- receiptResult{types.TransactionReceipt{}, tx.Hash, tx, err}
				}
				return
			}

			// Match receipts with transactions
			for j, receipt := range receipts {
				results <- receiptResult{*receipt, txBatch[j].Hash, txBatch[j], nil}
			}
		}(batch, hashes)
	}

	go func() {
		wg.Wait()
		close(results)
	}()

	// Process both logs and transactions
	txs := make([]*types.Transaction, 0)

	for result := range results {
		if result.err != nil {
			log.Printf("failed to get receipt for tx %s: %v", result.txHash, result.err)
			continue
		}

		tx := result.tx
		tx.Logs = result.receipt.Logs
		tx.Timestamp = blockTimestamp
		tx.Status = result.receipt.Status
		tx.MessageCid = result.receipt.MessageCid
		txs = append(txs, &tx)
	}

	if len(txs) > 0 {
		if err := ind.processor.ProcessTransactions(ctx, txs); err != nil {
			return fmt.Errorf("failed to process block data: %w", err)
		}
	}

	return nil
}

// Reconcilation Protocol
func toBlockInfo(block *types.EthBlock, isProcessed bool) *types.BlockInfo {
	blockNumber, err := strconv.ParseInt(block.Number, 0, 64)
	if err != nil {
		log.Printf("failed to parse block number: %v", err)
	}
	timestamp, err := strconv.ParseUint(block.Timestamp, 0, 64)
	if err != nil {
		log.Printf("failed to parse timestamp: %v", err)
	}
	return &types.BlockInfo{
		Height:      blockNumber,
		Hash:        block.Hash,
		ParentHash:  block.ParentHash,
		Timestamp:   timestamp,
		IsProcessed: isProcessed,
	}
}

func (i *Indexer) detectReorg(ctx context.Context, height uint64, block *types.BlockInfo) (bool, uint64, error) {
	// TOD0: implement
	parentBlock, err := i.db.GetBlockByHeight(ctx, height-1)
	if err != nil {
		return false, 0, fmt.Errorf("failed to get block: %w", err)
	}
	if parentBlock == nil {
		return false, 0, nil
	}

	if parentBlock.Hash != block.ParentHash {
		reorgDepth, err := i.findReorgDepth(ctx, height)
		if err != nil {
			return false, 0, fmt.Errorf("failed to find reorg depth: %w", err)
		}

		return true, reorgDepth, nil
	}

	return false, 0, nil
}

func (i *Indexer) findReorgDepth(ctx context.Context, height uint64) (uint64, error) {
	var depth uint64 = 0
	currentHeight := height - 1
	for currentHeight > 0 {
		// Get chain block
		block, err := i.getBlockWithTransactions(currentHeight, false)
		if err != nil {
			return 0, fmt.Errorf("failed to get chain block: %w", err)
		}
		// Handle null epoch case
		if block == nil {
			// Skip this height and continue searching
			depth++
			currentHeight--
			continue
		}

		// Get stored block
		storedBlock, err := i.db.GetBlockByHeight(ctx, currentHeight)
		if err != nil {
			return 0, fmt.Errorf("failed to get block: %w", err)
		}
		// Handle null epoch case
		if storedBlock == nil {
			depth++
			currentHeight--
			continue
		}

		chainBlock := toBlockInfo(block, false)
		if chainBlock == nil {
			depth++
			currentHeight--
			continue
		}
		
		// If hashes match, we found the fork point
		if storedBlock.Hash == chainBlock.Hash {
			log.Printf("Found fork point at height %d, reorg depth: %d", currentHeight, depth)
			return depth, nil
		}
		depth++
		currentHeight--

		if depth > 1000 {
			return 0, fmt.Errorf("reorg depth exceeds maximum allowed: (1000 blocks)")
		}
	}
	return 0, nil
}

func (i *Indexer) tryStartReorg(ctx context.Context, startHeight, endHeight uint64) (context.Context, bool) {
	i.reorgMutex.Lock()
	defer i.reorgMutex.Unlock()

	// Check if there's an active reorg that overlaps with our range
	for _, state := range i.activeReorgs {
		if state.startHeight <= endHeight && startHeight <= state.endHeight {
			// Overlapping reorg in progress
			log.Printf("Skipping reorg for block range %d-%d: overlaps with active reorg %d-%d",
				startHeight, endHeight, state.startHeight, state.endHeight)
			return nil, false
		}

		// Clean up any stale reorgs (older than 10 minutes)
		if time.Since(state.startTime) > 10*time.Minute {
			state.cancel()
			delete(i.activeReorgs, state.startHeight)
		}
	}

	// Create new context with timeout
	reorgCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	i.activeReorgs[startHeight] = &reorgState{
		startHeight: startHeight,
		endHeight:   endHeight,
		startTime:   time.Now(),
		cancel:      cancel,
	}

	return reorgCtx, true
}

// Helper function to finish a reorg
func (i *Indexer) finishReorg(startHeight uint64) {
	i.reorgMutex.Lock()
	defer i.reorgMutex.Unlock()

	if state, exists := i.activeReorgs[startHeight]; exists {
		state.cancel()
		delete(i.activeReorgs, startHeight)
	}
}

func (i *Indexer) reconcile(ctx context.Context, startHeight uint64, currentHeight uint64) error {
	log.Printf("Starting reconciliation from height %d to %d", startHeight, currentHeight)

	// Begin transaction for atomic reorg handling
	tx, err := i.db.BeginTx(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Add periodic context checks throughout reconciliation
	steps := []func() error{
		func() error {
			if err := ctx.Err(); err != nil {
				return err
			}
			return i.db.DeleteReorgedData(ctx, startHeight, currentHeight)
		},
	}

	// Execute each step with context checking
	for _, step := range steps {
		if err := step(); err != nil {
			return err
		}
	}

	// Reprocess blocks from the fork point with context checking
	for height := startHeight; height <= currentHeight; height += maxBlocksPerBatch + 1 {
		if err := ctx.Err(); err != nil {
			return err
		}

		blocks, err := i.getBlocksWithTransactions(height, height+maxBlocksPerBatch, true)
		if err != nil {
			return fmt.Errorf("failed to get block %d: %w", height, err)
		}

		for _, block := range blocks {
			if err := ctx.Err(); err != nil {
				return err
			}

			if err := i.processTipset(ctx, block); err != nil {
				return fmt.Errorf("failed to reprocess block %x: %w", block.Number, err)
			}

			log.Printf("Reprocessed block %x during reconciliation", block.Number)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit reorg changes: %w", err)
	}

	log.Printf("Completed reconciliation from height %d to %d", startHeight, currentHeight)
	return nil
}

// toBlockNumArg converts a block number to hex format required by Ethereum JSON-RPC
func toBlockNumArg(number uint64) string {
	return fmt.Sprintf("0x%x", number)
}

// cleanupFinalizedData removes unnecessary historical data for finalized blocks
func (i *Indexer) cleanupFinalizedData(ctx context.Context, currentBlockNumber uint64) error {
	// Only cleanup if we have enough blocks for finalization
	if currentBlockNumber < blockFinalizationDepth {
		return nil
	}

	log.Printf("Running cleanup for finalized blocks up to %d", currentBlockNumber-blockFinalizationDepth)

	// Cleanup historical transfer versions
	if err := i.db.CleanupFinalizedData(ctx, currentBlockNumber); err != nil {
		return fmt.Errorf("failed to cleanup finalized data: %w", err)
	}

	return nil
}
