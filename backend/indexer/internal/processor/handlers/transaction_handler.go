package handlers

import (
	"context"
	"fmt"
	"pdp-explorer-indexer/internal/models"
	"pdp-explorer-indexer/internal/types"
	"strconv"
	"strings"
	"time"
)


type TransactionHandler struct {
	types.BaseHandler
	db Database
}

func NewTransactionHandler (db Database) *TransactionHandler {
	return &TransactionHandler{
		BaseHandler: types.NewBaseHandler(types.HandlerTypeFunction),
		db:          db,
	}
}

func (h *TransactionHandler) HandleFunction(ctx context.Context, tx types.Transaction) error {
	blockNumber, err := blockNumberToUint64(tx.BlockNumber)
	if err != nil {
		return fmt.Errorf("failed to parse block number: %w", err)
	}

	setId, err := getSetIdFromTxInput(tx.Input)
	if err != nil {
		return fmt.Errorf("failed to parse setId from transaction input: %w", err)
	}

	createdAt := time.Unix(tx.Timestamp, 0)

	// Convert transaction status from hex string to boolean
	// Any non-zero value means success, zero means failure
	txStatus := false
	if status, err := strconv.ParseInt(strings.TrimPrefix(tx.Status, "0x"), 16, 64); err == nil {
		txStatus = status != 0
	}

	// TODO; missing messagecid
	dbTx := &models.Transaction{
		ReorgModel: models.ReorgModel{
			BlockNumber: blockNumber,
			BlockHash:   tx.BlockHash,
		},
		Hash:        tx.Hash,
		ProofSetId:  setId.Int64(),
		MessageId:   "",
		Height:      int64(blockNumber),
		FromAddress: tx.From,
		ToAddress:   tx.To,
		Value:       hexToInt64(tx.Value),
		Method:      tx.Method,
		Status:      txStatus,
		CreatedAt:   createdAt,
	}

	if err := h.db.StoreTransaction(ctx, dbTx); err != nil {
		return fmt.Errorf("failed to store transaction: %w", err)
	}

	return nil
}