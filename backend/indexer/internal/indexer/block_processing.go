package indexer

import (
	"context"
	"fmt"
	"log"
	"pdp-explorer-indexer/internal/processor"
	"sync"
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
		block, err := i.getBlockWithTransactions(blockNum, true)
		if err != nil {
			return fmt.Errorf("failed to get block: %w", err)
		}

		// TODO: Reorg detection
		// blockInfo := toBlockInfo(block)
		// isReorg, reorgDepth, err := i.detectReorg(ctx, blockNum, blockInfo)
		// if err != nil {
		// 	return fmt.Errorf("failed to detect reorg: %w", err)
		// }
		// if isReorg {
		// 	reorgStartBlock := blockNum - 1 - reorgDepth
		// 	if err := i.reconcile(ctx, reorgStartBlock, blockNum); err != nil {
		// 		return fmt.Errorf("failed to handle reorg: %w", err)
		// 	}
		// }

		if err := i.processTipset(ctx, block); err != nil {
			log.Printf("Error processing block %d: %v", blockNum, err)
			return err
		}

		if err := i.db.UpdateSyncState(ctx, int64(blockNum), "synced"); err != nil {
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

func (i *Indexer) processTipset(ctx context.Context, block *EthBlock) error {

	// Create wait group and results channel
	var wg sync.WaitGroup
	type receiptResult struct {
		receipt TransactionReceipt
		txHash  string
		err     error
	}
	results := make(chan receiptResult, len(block.Transactions))

	// Launch goroutines for parallel receipt fetching
	for _, tx := range block.Transactions {
		wg.Add(1)
		go func(tx Transaction) {
			defer wg.Done()
			receipt, err := i.getTransactionReceipt(tx.Hash)
			results <- receiptResult{receipt, tx.Hash, err}
		}(tx)
	}

	go func() {
		wg.Wait()
		close(results)
	}()

	for result := range results {
		if result.err != nil {
			log.Printf("failed to get receipt for tx %s: %v", result.txHash, result.err)
			continue
		}

		// Process logs
		logs := make([]processor.Log, 0)
		for _, event := range result.receipt.Logs {
			logEntry := processor.Log{
				Address:         event.Address,
				BlockNumber:     result.receipt.BlockNumber,
				TransactionHash: result.txHash,
				Data:            event.Data,
				Topics:          event.Topics,
				LogIndex:        event.LogIndex,
			}
			logs = append(logs, logEntry)
		}

		if err := i.eventProcessor.ProcessLogs(ctx, logs); err != nil {
			log.Printf("failed to process logs for tx %s: %v", result.txHash, err)
		}
	}

	return nil
}

// Reconcilation Protocol
func toBlockInfo(block *EthBlock) *BlockInfo {
	return &BlockInfo{
		Height:     block.Number,
		Hash:       block.Hash,
		ParentHash: block.ParentHash,
	}
}

func (i *Indexer) detectReorg(ctx context.Context, height uint64, block *BlockInfo) (bool, uint64, error) {
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
		chainBlock := toBlockInfo(block)
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

func (i *Indexer) reconcile(ctx context.Context, startHeight uint64, currentHeight uint64) error {
	log.Printf("Starting reconciliation from height %d to %d", startHeight, currentHeight)

	tx, err := i.db.BeginTx(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Move reorged blocks to history table
	if err := tx.MoveToReorgedBlocks(ctx, startHeight, currentHeight); err != nil {
		return fmt.Errorf("failed to move reorged blocks: %w", err)
	}

	// Reprocess blocks from the fork point
	for height := startHeight; height <= currentHeight; height++ {
		block, err := i.getBlockWithTransactions(height, true)
		if err != nil {
			return fmt.Errorf("failed to get block %d: %w", height, err)
		}

		if err := i.processTipset(ctx, block); err != nil {
			return fmt.Errorf("failed to reprocess block %d: %w", height, err)
		}

		log.Printf("Reprocessed block %d during reconciliation", height)
	}

	log.Printf("Completed reconciliation from height %d to %d", startHeight, currentHeight)
	return nil
}

// toBlockNumArg converts a block number to hex format required by Ethereum JSON-RPC
func toBlockNumArg(number uint64) string {
	return fmt.Sprintf("0x%x", number)
}

func (i *Indexer) getBlockWithTransactions(height uint64, withTxs bool) (*EthBlock, error) {
	var block EthBlock
	blockNum := toBlockNumArg(height)
	err := i.callRPC("Filecoin.EthGetBlockByNumber", []interface{}{blockNum, withTxs}, &block)
	if err != nil {
		return nil, fmt.Errorf("failed to get block: %w", err)
	}
	return &block, nil
}

func (i *Indexer) getTransactionReceipt(hash string) (TransactionReceipt, error) {
	var blockReceipt TransactionReceipt
	err := i.callRPC("Filecoin.EthGetTransactionReceipt", []interface{}{hash}, &blockReceipt)
	if err != nil {
		return TransactionReceipt{}, fmt.Errorf("failed to get block receipts: %w", err)
	}
	return blockReceipt, nil
}

// Required types for processing
type Transaction struct {
	ChainId              string        `json:"chainId"`
	Nonce                string        `json:"nonce"`
	BlockHash            string        `json:"blockHash"`
	BlockNumber          string        `json:"blockNumber"`
	Hash                 string        `json:"hash"`
	TransactionIndex     string        `json:"transactionIndex"`
	From                 string        `json:"from"`
	To                   string        `json:"to"`
	Value                string        `json:"value"`
	GasPrice             string        `json:"gasPrice"`
	Gas                  string        `json:"gas"`
	MaxFeePerGas         string        `json:"maxFeePerGas"`
	Type                 string        `json:"type"`
	AccessList           []interface{} `json:"accessList"`
	V                    string        `json:"v"`
	R                    string        `json:"r"`
	S                    string        `json:"s"`
	MaxPriorityFeePerGas string        `json:"maxPriorityFeePerGas"`
	Input                string        `json:"input"`
}

type TransactionReceipt struct {
	TransactionHash   string `json:"transaction_hash"`
	TransactionIndex  string `json:"transaction_index"`
	BlockHash         string `json:"block_hash"`
	BlockNumber       string `json:"block_number"`
	From              string `json:"from"`
	To                string `json:"to"`
	Root              string `json:"root"`
	Status            string `json:"status"`
	ContractAddress   string `json:"contract_address"`
	CumulativeGasUsed string `json:"cumulative_gas_used"`
	EffectiveGasPrice string `json:"effective_gas_price"`
	GasUsed           string `json:"gas_used"`
	LogsBloom         string `json:"logs_bloom"`
	Type              string `json:"type"`
	Logs              []Log  `json:"logs"`
}

type EthBlock struct {
	Number           string        `json:"number"`
	Hash             string        `json:"hash"`
	ParentHash       string        `json:"parentHash"`
	Nonce            string        `json:"nonce"`
	Sha3Uncles       string        `json:"sha3Uncles"`
	LogsBloom        string        `json:"logsBloom"`
	Transactions     []Transaction `json:"transactions"`
	TransactionsRoot string        `json:"transactionsRoot"`
	ReceiptsRoot     string        `json:"receiptsRoot"`
	StateRoot        string        `json:"stateRoot"`
	Difficulty       string        `json:"difficulty"`
	GasLimit         string        `json:"gasLimit"`
	GasUsed          string        `json:"gasUsed"`
	Miner            string        `json:"miner"`
	TotalDifficulty  string        `json:"totalDifficulty"`
	Size             string        `json:"size"`
	ExtraData        string        `json:"extraData"`
}

type Log struct {
	Address          string   `json:"address"`
	Topics           []string `json:"topics"`
	Data             string   `json:"data"`
	Removed          bool     `json:"removed"`
	LogIndex         string   `json:"log_index"`
	BlockNumber      string   `json:"block_number"`
	BlockHash        string   `json:"block_hash"`
	TransactionHash  string   `json:"transaction_hash"`
	TransactionIndex string   `json:"transaction_index"`
}

type BlockInfo struct {
	Height     string `db:"height"`
	Hash       string `db:"hash"`
	ParentHash string `db:"parent_hash"`
}
