package types

import "encoding/json"

// Log represents a blockchain event log
type Log struct {
	Address          string   `json:"address"`
	Topics           []string `json:"topics"`
	Data             string   `json:"data"`
	Removed          bool     `json:"removed"`
	LogIndex         string   `json:"logIndex"`
	BlockNumber      string   `json:"blockNumber"`
	BlockHash        string   `json:"blockHash"`
	TransactionHash  string   `json:"transactionHash"`
	TransactionIndex string   `json:"transactionIndex"`

	// Manually added
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
	AccessList           []interface{} `json:"accessList"`

	// These are manually added
	Logs                 []Log         `json:"logs"`
	Timestamp            int64         `json:"timestamp"`
	Method               string        `json:"method"`
	MessageCid           string        `json:"messageCid"`
	Status               string        `json:"status"`
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

	// Manually added
	MessageCid string `json:"messageCid"`
}

// TransactionOrHash can unmarshal both Transaction objects and transaction hashes
type TransactionOrHash struct {
	Transaction
	hashOnly string
}

// UnmarshalJSON implements the json.Unmarshaler interface
func (t *TransactionOrHash) UnmarshalJSON(data []byte) error {
	// Try unmarshaling as a string (transaction hash) first
	var hash string
	if err := json.Unmarshal(data, &hash); err == nil {
		t.hashOnly = hash
		return nil
	}

	// If that fails, try unmarshaling as a Transaction object
	return json.Unmarshal(data, &t.Transaction)
}

type EthBlock struct {
	Number           string             `json:"number"`
	Hash             string             `json:"hash"`
	ParentHash       string             `json:"parentHash"`
	Nonce            string             `json:"nonce"`
	Sha3Uncles       string             `json:"sha3Uncles"`
	LogsBloom        string             `json:"logsBloom"`
	TransactionsRoot string             `json:"transactionsRoot"`
	ReceiptsRoot     string             `json:"receiptsRoot"`
	StateRoot        string             `json:"stateRoot"`
	Difficulty       string             `json:"difficulty"`
	GasLimit         string             `json:"gasLimit"`
	GasUsed          string             `json:"gasUsed"`
	Miner            string             `json:"miner"`
	Timestamp        string             `json:"timestamp"`
	TotalDifficulty  string             `json:"totalDifficulty"`
	Size             string             `json:"size"`
	ExtraData        string             `json:"extraData"`
	Transactions     []TransactionOrHash `json:"transactions"`
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

