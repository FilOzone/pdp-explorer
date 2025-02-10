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
)

func (i *Indexer) processBatch(ctx context.Context, startBlock, safeBlock uint64) error {
	endBlock := safeBlock
	if endBlock-startBlock > maxBlocksPerBatch {
		endBlock = startBlock + maxBlocksPerBatch
	}

	log.Printf("Processing blocks from %d to %d (batch size: %d)",
		startBlock, endBlock, endBlock-startBlock+1)

	processed := 0
	for blockNum := startBlock; blockNum <= endBlock; blockNum++ {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		// Get block with transactions
		block, err := i.getBlockWithTransactions(blockNum, true)
		if err != nil {
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

		i.setLastBlock(blockNum)
		processed++
	}

	log.Printf("Successfully processed %d blocks from %d to %d",
		processed, startBlock, endBlock)
	return nil
}

func (i *Indexer) processTipset(ctx context.Context, block *types.EthBlock) error {
	if block == nil {
		return fmt.Errorf("block is nil")
	}

	blockTimestamp, err := strconv.ParseInt(block.Timestamp, 0, 64)
	if err != nil {
		return fmt.Errorf("failed to parse block timestamp: %w", err)
	}

	var wg sync.WaitGroup
	type receiptResult struct {
		receipt types.TransactionReceipt
		txHash  string
		tx      types.Transaction
		err     error
	}
	results := make(chan receiptResult, len(block.Transactions))

	// Launch goroutines for parallel receipt fetching
	for _, tx := range block.Transactions {
		contracts := i.processor.GetContractAddresses()
		shouldFetchReceipt := false

		for _, contract := range contracts {
			if strings.EqualFold(contract, tx.To) {
				shouldFetchReceipt = true
				break
			}
		}

		if !shouldFetchReceipt {
			continue
		}

		wg.Add(1)
		go func(tx types.Transaction) {
			defer wg.Done()
			receipt, err := i.getTransactionReceipt(tx.Hash)
			results <- receiptResult{receipt, tx.Hash, tx, err}
		}(tx)
	}

	go func() {
		wg.Wait()
		close(results)
	}()

	// Process both logs and transactions
	logs := make([]types.Log, 0)
	txs := make([]types.Transaction, 0)

	for result := range results {
		if result.err != nil {
			log.Printf("failed to get receipt for tx %s: %v", result.txHash, result.err)
			continue
		}

		// Process event logs
		for _, event := range result.receipt.Logs {
			event.Timestamp = blockTimestamp
			logs = append(logs, event)
		}

		tx := result.tx
		tx.Timestamp = blockTimestamp
		txs = append(txs, tx)
	}

	blockData := types.BlockData{
		Transactions: txs,
		Logs:         logs,
	}

	if len(txs) > 0 || len(logs) > 0 {
		if err := i.processor.ProcessBlockData(ctx, blockData); err != nil {
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
		storedBlock, err := i.db.GetBlockByHeight(ctx, currentHeight)
		if err != nil {
			return 0, fmt.Errorf("failed to get block: %w", err)
		}
		// Get chain block
		block, err := i.getBlockWithTransactions(currentHeight, false)
		if err != nil {
			return 0, fmt.Errorf("failed to get chain block: %w", err)
		}
		chainBlock := toBlockInfo(block, false)
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
	for height := startHeight; height <= currentHeight; height++ {
		if err := ctx.Err(); err != nil {
			return err
		}

		block, err := i.getBlockWithTransactions(height, true)
		if err != nil {
			return fmt.Errorf("failed to get block %d: %w", height, err)
		}

		if err := i.processTipset(ctx, block); err != nil {
			return fmt.Errorf("failed to reprocess block %d: %w", height, err)
		}

		log.Printf("Reprocessed block %d during reconciliation", height)
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

func (i *Indexer) getBlockWithTransactions(height uint64, withTxs bool) (*types.EthBlock, error) {
	var block types.EthBlock
	blockNum := toBlockNumArg(height)
	err := i.callRPC("Filecoin.EthGetBlockByNumber", []interface{}{blockNum, withTxs}, &block)
	if err != nil {
		return nil, fmt.Errorf("failed to get block: %w", err)
	}
	return &block, nil
}

func (i *Indexer) getTransactionReceipt(hash string) (types.TransactionReceipt, error) {
	var blockReceipt types.TransactionReceipt
	err := i.callRPC("Filecoin.EthGetTransactionReceipt", []interface{}{hash}, &blockReceipt)
	if err != nil {
		return types.TransactionReceipt{}, fmt.Errorf("failed to get block receipts: %w", err)
	}
	return blockReceipt, nil
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
