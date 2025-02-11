package types

import (
	"context"
	"fmt"
)

// Log represents a blockchain event log
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
	From             string   `json:"from"`
	To               string   `json:"to"`
	Timestamp        int64    `json:"timestamp"`
}

// Transaction represents a blockchain transaction
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
	V                    string        `json:"v"`
	R                    string        `json:"r"`
	S                    string        `json:"s"`
	MaxPriorityFeePerGas string        `json:"maxPriorityFeePerGas"`
	Input                string        `json:"input"`
	Timestamp            int64         `json:"timestamp"`
	AccessList           []interface{} `json:"accessList"`
	Method               string        `json:"method"`
}

// TransactionReceipt represents a blockchain transaction receipt
type TransactionReceipt struct {
	TransactionHash   string `json:"transactionHash"`
	TransactionIndex  string `json:"transactionIndex"`
	BlockHash         string `json:"blockHash"`
	BlockNumber       string `json:"blockNumber"`
	From              string `json:"from"`
	To                string `json:"to"`
	Root              string `json:"root"`
	Status            string `json:"status"`
	ContractAddress   string `json:"contractAddress"`
	CumulativeGasUsed string `json:"cumulativeGasUsed"`
	EffectiveGasPrice string `json:"effectiveGasPrice"`
	GasUsed           string `json:"gasUsed"`
	LogsBloom         string `json:"logsBloom"`
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
	TransactionsRoot string        `json:"transactionsRoot"`
	ReceiptsRoot     string        `json:"receiptsRoot"`
	StateRoot        string        `json:"stateRoot"`
	Difficulty       string        `json:"difficulty"`
	GasLimit         string        `json:"gasLimit"`
	GasUsed          string        `json:"gasUsed"`
	Miner            string        `json:"miner"`
	Timestamp        string        `json:"timestamp"`
	TotalDifficulty  string        `json:"totalDifficulty"`
	Size             string        `json:"size"`
	ExtraData        string        `json:"extraData"`
	Transactions     []Transaction `json:"transactions"`
}

type BlockInfo struct {
	Height      int64  `db:"height"`
	Hash        string `db:"hash"`
	ParentHash  string `db:"parent_hash"`
	IsProcessed bool   `db:"is_processed"`
	Timestamp   uint64 `db:"timestamp"`
}

// BlockData represents all the data from a block that needs processing
type BlockData struct {
	Transactions []Transaction
	Logs         []Log
}

// Base Handler
// Handler types
const (
	HandlerTypeEvent    = "event"
	HandlerTypeFunction = "function"
)

// EventHandler is the interface for handling event logs
type EventHandler interface {
	HandleEvent(ctx context.Context, log Log, tx *Transaction) error
}

// FunctionHandler is the interface for handling function calls
type FunctionHandler interface {
	HandleFunction(ctx context.Context, tx Transaction) error
}

// Handler is a combined interface that can handle both events and functions
type Handler interface {
	GetType() string // Returns HandlerTypeEvent or HandlerTypeFunction
	EventHandler
	FunctionHandler
}

// BaseHandler provides a default implementation of Handler interface
type BaseHandler struct {
	HandlerType string
}

// NewBaseHandler creates a new BaseHandler with the specified type
func NewBaseHandler(handlerType string) BaseHandler {
	return BaseHandler{HandlerType: handlerType}
}

func (h *BaseHandler) GetType() string {
	return h.HandlerType
}

// Default implementations that return errors for unimplemented methods
func (h *BaseHandler) HandleEvent(ctx context.Context, log Log, tx *Transaction) error {
	return fmt.Errorf("HandleEvent not implemented for this handler")
}

func (h *BaseHandler) HandleFunction(ctx context.Context, tx Transaction) error {
	return fmt.Errorf("HandleFunction not implemented for this handler")
}