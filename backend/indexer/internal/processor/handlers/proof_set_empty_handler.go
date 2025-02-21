package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"time"

	"pdp-explorer-indexer/internal/models"
	"pdp-explorer-indexer/internal/types"

	poolType "github.com/jmoiron/sqlx/types"
)


type ProofSetEmptyHandler struct {
	BaseHandler
	db Database
}


func NewProofSetEmptyHandler(db Database) *ProofSetEmptyHandler {
	return &ProofSetEmptyHandler{
		BaseHandler: NewBaseHandler(HandlerTypeEvent),
		db:          db,
	}
}


// ProofSetEmptyHandler handles ProofSetEmpty events
func (h *ProofSetEmptyHandler) HandleEvent(ctx context.Context, eventLog types.Log, tx *types.Transaction) error {
	log.Printf("Processing ProofSetEmpty event. Data: %s", eventLog.Data)

	// Parse setId from topics
	setId, err := getSetIdFromTopic(eventLog.Topics[1])
	if err != nil {
		return fmt.Errorf("failed to parse setId from topics: %w", err)
	}
	log.Printf("Parsed setId: %s", setId)

	dbEventData, err := json.Marshal(map[string]interface{}{
		"setId": setId.String(),
	})
	if err != nil {
		return fmt.Errorf("failed to marshal event data: %w", err)
	}

	blockNumber, err := blockNumberToUint64(eventLog.BlockNumber)
	if err != nil {
		return fmt.Errorf("failed to parse block number: %w", err)
	}

	dbEventLog := &models.EventLog{
		ReorgModel: models.ReorgModel{
			BlockNumber: blockNumber,
			BlockHash:   eventLog.BlockHash,
		},
		SetId:           setId.Int64(),
		Name:            "ProofSetEmpty",
		Address:         eventLog.Address,
		Data:            poolType.JSONText(dbEventData),
		Removed:         eventLog.Removed,
		Topics:          eventLog.Topics,
		LogIndex:        hexToInt64(eventLog.LogIndex),
		TransactionHash: eventLog.TransactionHash,
		CreatedAt:       time.Unix(eventLog.Timestamp, 0),
	}

	if err := h.db.StoreEventLog(ctx, dbEventLog); err != nil {
		return fmt.Errorf("failed to store event log: %w", err)
	}

	updatedAt := time.Unix(int64(eventLog.Timestamp), 0)

	proofSets, err := h.db.FindProofSet(ctx, setId.Int64(), false)
	if err != nil {
		return fmt.Errorf("failed to find proof set: %w", err)
	}
	if len(proofSets) != 0 {
		proofSet := proofSets[0]

		proofSet.TotalRoots = 0
		proofSet.TotalDataSize = big.NewInt(0)
		proofSet.LastProvenEpoch = 0
		proofSet.NextChallengeEpoch = 0
		proofSet.UpdatedAt = updatedAt
		proofSet.BlockNumber = blockNumber
		proofSet.BlockHash = eventLog.BlockHash
		if err := h.db.StoreProofSet(ctx, proofSet); err != nil {
			return fmt.Errorf("failed to store proof set: %w", err)
		}
	}
	log.Printf("Successfully marked proof set %s as empty", setId)

	return nil
}
