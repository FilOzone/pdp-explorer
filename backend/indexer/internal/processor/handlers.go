package processor

import (
	"context"
	"encoding/hex"
	"fmt"
	"log"
	"math/big"
	"strings"
	"time"
)

// Database interface defines methods needed by handlers
type Database interface {
	StoreTransfer(ctx context.Context, transfer *Transfer) error
	DeleteReorgedTransfers(ctx context.Context, startHeight, endHeight uint64) error
	RestorePreviousTransfers(ctx context.Context, startHeight uint64) error
	CleanupFinalizedTransfers(ctx context.Context, currentBlockNumber uint64) error
}

// Transfer represents a WFIL transfer
type Transfer struct {
	ID           int64     `db:"id"`
	FromAddress  string    `db:"from_address" json:"from_address"`
	ToAddress    string    `db:"to_address" json:"to_address"`
	Amount       *big.Int  `db:"amount" json:"amount"`
	TxHash      string    `db:"tx_hash" json:"tx_hash"`
	BlockNumber uint64    `db:"block_number" json:"block_number"`
	BlockHash   string    `db:"block_hash" json:"block_hash"`
	LogIndex    string    `db:"log_index" json:"log_index"`
	IsLatest    bool      `db:"is_latest" json:"is_latest"`
	PreviousID  *int64    `db:"previous_id" json:"previous_id,omitempty"`
	CreatedAt   time.Time `db:"created_at_time" json:"created_at"`
}

type TransferHandler struct {
	db Database
}

type WithdrawFunctionHandler struct {
	db Database
}

// Constructor functions
func NewTransferHandler(db Database) *TransferHandler {
	return &TransferHandler{db: db}
}

func NewWithdrawFunctionHandler(db Database) *WithdrawFunctionHandler {
	return &WithdrawFunctionHandler{db: db}
}

// Handle implementations
func (h *TransferHandler) Handle(ctx context.Context, eventLog Log) error {
	if len(eventLog.Topics) != 3 {
		return fmt.Errorf("invalid topics length for Transfer event")
	}

	// Parse from and to addresses (they are indexed parameters)
	fromAddress := strings.ToLower(fmt.Sprintf("0x%s", eventLog.Topics[1][26:])) // Remove padding
	toAddress := strings.ToLower(fmt.Sprintf("0x%s", eventLog.Topics[2][26:]))   // Remove padding

	// Parse amount from data
	data := strings.TrimPrefix(eventLog.Data, "0x")
	if len(data) < 64 { // 1 parameter * 32 bytes
		return fmt.Errorf("invalid data length for Transfer")
	}

	amount := new(big.Int).SetBytes(hexToBytes(data[:64]))

	transfer := &Transfer{
		FromAddress: fromAddress,
		ToAddress:   toAddress,
		Amount:      amount,
		TxHash:      eventLog.TransactionHash,
		BlockNumber: blockNumberToUint64(eventLog.BlockNumber),
		BlockHash:   eventLog.BlockHash,
		LogIndex:    eventLog.LogIndex,
	}

	return h.db.StoreTransfer(ctx, transfer)
}

func (h *WithdrawFunctionHandler) Handle(ctx context.Context, eventLog Log) error {
	data := strings.TrimPrefix(eventLog.Data, "0x")
	if len(data) < 64 { //  32 bytes (uint256)
		return fmt.Errorf("invalid data length for withdraw function")
	}

	log.Printf("WithdrawFunctionHandler: %s", eventLog.Data)

	return nil
}

// Helper functions
func hexToBytes(s string) []byte {
	b, _ := hex.DecodeString(s)
	return b
}

func blockNumberToUint64(blockNumber string) uint64 {
	// Remove "0x" prefix if present
	blockNumber = strings.TrimPrefix(blockNumber, "0x")
	n := new(big.Int)
	n.SetString(blockNumber, 16)
	return n.Uint64()
}
