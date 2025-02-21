package indexer

import (
	"encoding/json"
	"fmt"
	"log"
	"pdp-explorer-indexer/internal/client"
	"pdp-explorer-indexer/internal/types"
)

const (
	ENullRound = 12
)

// getBlocksWithTransactions fetches blocks in batch using a single RPC call
func (i *Indexer) getBlocksWithTransactions(from, to uint64, withTxs bool) ([]*types.EthBlock, error) {
	if to - from > 100 {
		return nil, fmt.Errorf("max batch size is 100")
	}

	// Prepare batch request
	methods := []string{"Filecoin.EthGetBlockByNumber"}
	params := [][]interface{}{{toBlockNumArg(from), withTxs}}

	for i := from + 1; i <= to; i++ {
		methods = append(methods, "Filecoin.EthGetBlockByNumber")
		params = append(params, []interface{}{toBlockNumArg(i), withTxs})
	}

	var rpcResponses []client.RPCResponse
	if err := i.client.CallRpcBatched(methods, params, &rpcResponses); err != nil {
		return nil, fmt.Errorf("failed to execute batch RPC call: %w", err)
	}

	var blocks []*types.EthBlock
	for _, response := range rpcResponses {
		if response.Error != nil {
			if response.Error.Code == ENullRound {
				log.Printf("Skipping null round block")
				continue
			}
			log.Printf("Received error: %s", response.Error.Message)
			continue
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

	var rpcResponses []client.RPCResponse
	if err := i.client.CallRpcBatched(methods, params, &rpcResponses); err != nil {
		return nil, fmt.Errorf("failed to execute batch RPC call: %w", err)
	}

	if len(rpcResponses) != len(hash)*2 {
		return nil, fmt.Errorf("unexpected number of responses: expected %d, got %d", len(hash)*2, len(rpcResponses))
	}

	// Process receipts
	receipts := make([]*types.TransactionReceipt, 0, len(hash))
	for i := 0; i < len(hash); i = i + 2 {
		// Process transaction receipt
		// if can't fetch tx receipt, skip
		if rpcResponses[0].Error != nil {
			fmt.Printf("RPC response error: %s\n", rpcResponses[0].Error.Message)
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