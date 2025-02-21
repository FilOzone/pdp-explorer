package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"strings"
	"time"

	"pdp-explorer-indexer/internal/models"
	"pdp-explorer-indexer/internal/types"

	poolType "github.com/jmoiron/sqlx/types"
)

type ProofSetCreatedHandler struct {
	BaseHandler
	db Database
}

func NewProofSetCreatedHandler(db Database) *ProofSetCreatedHandler {
	return &ProofSetCreatedHandler{
		BaseHandler: NewBaseHandler(HandlerTypeEvent),
		db:          db,
	}
}


// ParseTransactionInput parses the input data from a transaction
func ParseTransactionInput(input string) (string, error) {
	if !strings.HasPrefix(input, hexPrefix) {
		return "", &ParseError{Field: "transaction_input", Msg: "missing hex prefix"}
	}

	// Remove hex prefix
	input = input[2:]
	
	// Input should be at least function selector (4 bytes = 8 chars) + one parameter (32 bytes = 64 chars)
	if len(input) < 72 {
		return "", &ParseError{Field: "transaction_input", Msg: "input too short"}
	}

	// Skip function selector (4 bytes = 8 chars)
	input = input[8:]

	addressHex := input[24:64]
	address := "0x" + addressHex

	return address, nil
}

func (h *ProofSetCreatedHandler) HandleEvent(ctx context.Context, eventLog types.Log, tx *types.Transaction) error {
	log.Printf("Handling ProofSetCreated event: %v\n", eventLog)
	// Parse Block Number
	blockNumber, err := blockNumberToUint64(eventLog.BlockNumber)
	if err != nil {
		return fmt.Errorf("failed to parse block number: %w", err)
	}
	// Parse setId from topics
	setId, err := getSetIdFromTopic(eventLog.Topics[1])
	if err != nil {
		return fmt.Errorf("failed to parse setId from topics: %w", err)
	}

	// Parse owner from topics (it's an indexed parameter)
	owner, err := getAddressFromTopic(eventLog.Topics[2])
	if err != nil {
		return fmt.Errorf("failed to parse owner from topics: %w", err)
	}

	// Parse listenerAddr from transaction input
	listenerAddr, err := ParseTransactionInput(tx.Input)
	if err != nil {
		return fmt.Errorf("failed to parse transaction input: %w", err)
	}

	// Convert timestamp to time.Time
	createdAt := time.Unix(eventLog.Timestamp, 0)

	// Create new Event Log
	data, err := json.Marshal(map[string]interface{}{
		"setId": setId.String(),
		"owner": owner,
	})
	if err != nil {
		return fmt.Errorf("failed to marshal event data: %w", err)
	}

	dbEventLog := &models.EventLog{
		ReorgModel: models.ReorgModel{
			BlockNumber: blockNumber,
			BlockHash:   eventLog.BlockHash,
		},
		SetId:           setId.Int64(),
		Name:            "ProofSetCreated",
		Address:         eventLog.Address,
		Data:            poolType.JSONText(data),
		Removed:         eventLog.Removed,
		Topics:          eventLog.Topics,
		LogIndex:        hexToInt64(eventLog.LogIndex),
		TransactionHash: eventLog.TransactionHash,
		CreatedAt:       createdAt,
	}

	if err := h.db.StoreEventLog(ctx, dbEventLog); err != nil {
		return fmt.Errorf("failed to store event log: %w", err)
	}

	value, ok := new(big.Int).SetString(tx.Value, 0)
	if !ok {
		return fmt.Errorf("failed to parse value: %w", err)
	}

	// Create new Transaction
	transaction := &models.Transaction{
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
		Value:       value,
		Method:      "createProofSet",
		Status:      true,
		CreatedAt:   createdAt,
	}

	if err := h.db.StoreTransaction(ctx, transaction); err != nil {
		return fmt.Errorf("failed to store transaction: %w", err)
	}

	// Create new proof set
	proofSet := &models.ProofSet{
		ReorgModel: models.ReorgModel{
			BlockNumber: blockNumber,
			BlockHash:   eventLog.BlockHash,
		},
		SetId:               setId.Int64(),
		Owner:               owner,
		ListenerAddr:        listenerAddr,
		TotalFaultedPeriods: 0,
		TotalDataSize:       big.NewInt(0),
		TotalRoots:          0,
		TotalFeePaid:        big.NewInt(0),
		LastProvenEpoch:     0,
		NextChallengeEpoch:  0,
		IsActive:            true,
		CreatedAt:           createdAt,
		UpdatedAt:           createdAt,
	}

	// Store proof set
	if err := h.db.StoreProofSet(ctx, proofSet); err != nil {
		return fmt.Errorf("failed to store proof set: %w", err)
	}

	// Find existing provider
	providers, err := h.db.FindProvider(ctx, owner, false)
	if err != nil {
		return fmt.Errorf("failed to find provider: %w", err)
	}

	setIdInt := setId.Int64()

	if len(providers) == 0 {
		// Create new provider
		provider := &models.Provider{
			ReorgModel: models.ReorgModel{
				BlockNumber: blockNumber,
				BlockHash:   eventLog.BlockHash,
			},
			Address:             owner,
			TotalFaultedPeriods: 0,
			TotalDataSize:       big.NewInt(0),
			ProofSetIds:         []int64{setIdInt},
			CreatedAt:           createdAt,
			UpdatedAt:           createdAt,
		}

		if err := h.db.StoreProvider(ctx, provider); err != nil {
			return fmt.Errorf("failed to store provider: %w", err)
		}
	} else {
		// Check if setId is already present in provider proof_set_ids
		provider := providers[0]
		for _, id := range provider.ProofSetIds {
			if id == setIdInt {
				return nil
			}
		}

		// Update existing provider's proof_set_ids
		provider.ProofSetIds = append(provider.ProofSetIds, setIdInt)
		provider.UpdatedAt = createdAt
		provider.BlockNumber = blockNumber
		provider.BlockHash = eventLog.BlockHash
		if err := h.db.StoreProvider(ctx, provider); err != nil {
			return fmt.Errorf("failed to update provider: %w", err)
		}
	}

	return nil
}