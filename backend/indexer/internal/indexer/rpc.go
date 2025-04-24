package indexer

import (
	"encoding/json"
	"fmt"
	"pdp-explorer-indexer/internal/client"
	"pdp-explorer-indexer/internal/logger"
	"pdp-explorer-indexer/internal/types"
	"strconv"
	"time"
)

const (
	ENullRound = 12
)

func (i *Indexer) getCurrentHeightWithRetries() (uint64, error) {
	methods := []string{"Filecoin.EthBlockNumber"}
	params := [][]interface{}{nil}
	rpcResponses, err := i.retryRPCBatched(methods, params)
	if err != nil {
		return 0, err
	}

	var blockNumberHex string
	err = json.Unmarshal(rpcResponses[0].Result, &blockNumberHex)
	if err != nil {
		return 0, fmt.Errorf("failed to parse block number: %w", err)
	}

	// Convert hex block number to uint64
	blockNumber, err := strconv.ParseUint(blockNumberHex[2:], 16, 64) // Remove "0x" prefix
	if err != nil {
		return 0, fmt.Errorf("failed to parse block number %s: %w", blockNumberHex, err)
	}

	logger.Infof("Current block number: %d (hex: %s)", blockNumber, blockNumberHex)

	return blockNumber, nil
}

func (i *Indexer) getBlockWithTransactions(height uint64, withTxs bool) (*types.EthBlock, error) {
	var rpcResponse client.RPCResponse
	blockNum := toBlockNumArg(height)
	rpcResponses, err := i.retryRPCBatched([]string{"Filecoin.EthGetBlockByNumber"}, [][]interface{}{{blockNum, withTxs}})
	if err != nil {
		return nil, err
	}
	rpcResponse = rpcResponses[0]

	if rpcResponse.Error != nil && rpcResponse.Error.Code == ENullRound {
		return nil, nil
	}
	block, err := parseBlock(rpcResponse.Result)
	if err != nil {
		return nil, fmt.Errorf("failed to parse block: %w", err)
	}
	return block, nil
}

// Returns true if there is any non null block error in a batch of RPC responses
func (i *Indexer) anyRPCError(rpcResponses []client.RPCResponse) *client.RPCError {
	for _, response := range rpcResponses {
		if response.Error != nil && response.Error.Code != ENullRound {
			return response.Error
		}
	}
	return nil
}

// Retry a batch of RPC calls with exponential backoff
func (i *Indexer) retryRPCBatched(methods []string, params [][]interface{}) ([]client.RPCResponse, error) {
	var rpcResponses []client.RPCResponse
	errCodeOnRetry := 0
	errMessageOnRetry := ""
	for retry := range make([]int, maxRetries) {
		if err := i.client.CallRpcBatched(methods, params, &rpcResponses); err != nil {
			errCodeOnRetry = 1 // client side error
			errMessageOnRetry = err.Error()
		} else {
			rpcErr := i.anyRPCError(rpcResponses)
			if rpcErr == nil {
				break // done retrying
			}
			errCodeOnRetry = rpcErr.Code
			errMessageOnRetry = rpcErr.Message
		}
		logger.Warnf("rpc failure on retry %d: (%d, %s)", retry+1, errCodeOnRetry, errMessageOnRetry)
		if retry == maxRetries-1 {
			return nil, fmt.Errorf("rpc failure after %d retries: %s", maxRetries, errMessageOnRetry)
		}
		backoffTime := time.Second * time.Duration(1<<uint(retry))
		time.Sleep(backoffTime)
	}

	return rpcResponses, nil
}

// getBlocksWithTransactions fetches blocks in batch using a single RPC call
func (i *Indexer) getBlocksWithTransactions(from, to uint64, withTxs bool) ([]*types.EthBlock, error) {
	if to-from > 100 {
		return nil, fmt.Errorf("max batch size is 100")
	}

	// Prepare batch request
	methods := []string{}
	params := [][]interface{}{}
	for i := from; i <= to; i++ {
		methods = append(methods, "Filecoin.EthGetBlockByNumber")
		params = append(params, []interface{}{toBlockNumArg(i), withTxs})
	}

	rpcResponses, err := i.retryRPCBatched(methods, params)
	if err != nil {
		return nil, err
	}

	blocks := make([]*types.EthBlock, 0, len(rpcResponses))
	for _, response := range rpcResponses {
		if response.Error != nil {
			if response.Error.Code == ENullRound {
				logger.Debug("Skipping null round block")
				continue
			}
			return blocks, fmt.Errorf("received error from RPC: %s", response.Error.Message)
		}
		block, err := parseBlock(response.Result)
		if err != nil {
			return nil, fmt.Errorf("failed to parse block: %w", err)
		}
		blocks = append(blocks, block)
	}
	return blocks, nil
}

func parseBlock(data interface{}) (*types.EthBlock, error) {
	blockBytes, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal block data: %w", err)
	}

	var block types.EthBlock
	if err := json.Unmarshal(blockBytes, &block); err != nil {
		return nil, fmt.Errorf("failed to unmarshal block: %w", err)
	}

	return &block, nil
}

// cidResponse represents the response structure for message CID
type cidResponse struct {
	Cid string `json:"/"`
}

func (i *Indexer) getTransactionsReceipts(hash []string) ([]*types.TransactionReceipt, error) {
	// We'll fetch receipts with message CID for a single tx So, limiting to 100 / 2 = 50
	if len(hash) > 50 {
		return nil, fmt.Errorf("max allowed rpc batch size is 100")
	}
	// Prepare batch request
	methods := []string{"Filecoin.EthGetTransactionReceipt", "Filecoin.EthGetMessageCidByTransactionHash"}
	params := [][]interface{}{{hash[0]}, {hash[0]}} // first call to get receipt, second to get message CID

	for i := 1; i < len(hash); i++ {
		methods = append(methods, "Filecoin.EthGetTransactionReceipt", "Filecoin.EthGetMessageCidByTransactionHash")
		params = append(params, []interface{}{hash[i]}, []interface{}{hash[i]})
	}

	rpcResponses, err := i.retryRPCBatched(methods, params)
	if err != nil {
		return nil, err
	}

	if len(rpcResponses) != len(hash)*2 {
		return nil, fmt.Errorf("unexpected number of responses: expected %d, got %d", len(hash)*2, len(rpcResponses))
	}

	// Process receipts
	receipts := make([]*types.TransactionReceipt, 0, len(hash))
	for i := 0; i < 2*len(hash); i = i + 2 {
		// Process transaction receipt
		// if can't fetch tx receipt, skip
		if rpcResponses[i].Error != nil {
			fmt.Printf("RPC response error: %s\n", rpcResponses[i].Error.Message)
			continue
		}

		// extract receipt
		blockReceipt, err := processTransactionReceipt(rpcResponses[i].Result)
		if err != nil {
			fmt.Printf("failed to process transaction receipt: %v\n", err)
			continue
		}

		// if can't fetch message CID, append receipt without message CID
		if rpcResponses[i+1].Error != nil {
			fmt.Printf("RPC response error: %s\n", rpcResponses[i+1].Error.Message)
			receipts = append(receipts, &blockReceipt)
			continue
		}

		// Process message CID
		messageCid, err := processMessageCid(rpcResponses[i+1].Result)
		if err != nil {
			fmt.Printf("failed to process message CID: %v\n", err)
			receipts = append(receipts, &blockReceipt)
			continue
		}

		// append message CID to receipt
		blockReceipt.MessageCid = messageCid

		receipts = append(receipts, &blockReceipt)
	}

	return receipts, nil
}

// processTransactionReceipt converts the RPC response into a TransactionReceipt
func processTransactionReceipt(data interface{}) (types.TransactionReceipt, error) {
	receiptBytes, err := json.Marshal(data)
	if err != nil {
		return types.TransactionReceipt{}, fmt.Errorf("failed to marshal receipt data: %w", err)
	}

	var receipt types.TransactionReceipt
	if err := json.Unmarshal(receiptBytes, &receipt); err != nil {
		return types.TransactionReceipt{}, fmt.Errorf("failed to unmarshal receipt: %w", err)
	}

	return receipt, nil
}

// processMessageCid extracts the message CID from the RPC response
func processMessageCid(data interface{}) (string, error) {
	cidBytes, err := json.Marshal(data)
	if err != nil {
		return "", fmt.Errorf("failed to marshal CID data: %w", err)
	}

	var response cidResponse
	if err := json.Unmarshal(cidBytes, &response); err != nil {
		return "", fmt.Errorf("failed to unmarshal CID: %w", err)
	}

	if response.Cid == "" {
		return "", fmt.Errorf("empty message CID received")
	}

	return response.Cid, nil
}
