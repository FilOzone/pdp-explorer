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

type NextProvingPeriodHandler struct {
	BaseHandler
	db Database
}

func NewNextProvingPeriodHandler(db Database) *NextProvingPeriodHandler {
	return &NextProvingPeriodHandler{
		BaseHandler: NewBaseHandler(HandlerTypeEvent),
		db:          db,
	}
}

// NextProvingPeriodHandler handles NextProvingPeriod events
// event Def - NextProvingPeriod(uint256 indexed setId, uint256 challengeEpoch, uint256 /*leafCount*/)
func (h *NextProvingPeriodHandler) HandleEvent(ctx context.Context, eventLog *types.Log, tx *types.Transaction) error {
	log.Printf("Processing NextProvingPeriod event. Data: %s", eventLog.Data)

	// Parse setId from topics
	setId, err := getSetIdFromTopic(eventLog.Topics[1])
	if err != nil {
		return fmt.Errorf("failed to parse setId from topics: %w", err)
	}
	log.Printf("Parsed setId: %s", setId)

	// Parse nextEpoch from data
	data := hexToBytes(eventLog.Data)
	if len(data) < 32 {
		return fmt.Errorf("invalid data length for NextProvingPeriod event")
	}
	nextEpoch := new(big.Int).SetBytes(data[:32]).Int64()
	log.Printf("Parsed nextEpoch: %d", nextEpoch)

	leafCount := new(big.Int).SetBytes(data[32:]).Uint64()
	log.Printf("Parsed leafCount: %d", leafCount)

	dbEventData, err := json.Marshal(map[string]interface{}{
		"setId":           setId.String(),
		"nextChallengeEpoch": nextEpoch,
		"leafCount": leafCount,
	})
	if err != nil {
		return fmt.Errorf("failed to marshal event data: %w", err)
	}

	blockNumber, err := blockNumberToUint64(eventLog.BlockNumber)
	if err != nil {
		return fmt.Errorf("failed to parse block number: %w", err)
	}

	createdAt := time.Unix(eventLog.Timestamp, 0)

	dbEventLog := &models.EventLog{
		ReorgModel: models.ReorgModel{
			BlockNumber: blockNumber,
			BlockHash:   eventLog.BlockHash,
		},
		SetId:           setId.Int64(),
		Name:            "NextProvingPeriod",
		Address:         eventLog.Address,
		LogIndex:        hexToInt64(eventLog.LogIndex),
		Data:            poolType.JSONText(dbEventData),
		Removed:         eventLog.Removed,
		Topics:          eventLog.Topics,
		TransactionHash: eventLog.TransactionHash,
		CreatedAt:       createdAt,
	}

	if err := h.db.StoreEventLog(ctx, dbEventLog); err != nil {
		return fmt.Errorf("failed to store event log: %w", err)
	}

	// Update the next_challenge_epoch in the proof set
	// Update proof set stats
	proofSets, err := h.db.FindProofSet(ctx, setId.Int64(), false)
	if err != nil {
		return fmt.Errorf("failed to find proof set: %w", err)
	}
	if len(proofSets) != 0 {
		proofSet := proofSets[0]

		proofSet.NextChallengeEpoch = nextEpoch
		proofSet.UpdatedAt = createdAt
		proofSet.BlockNumber = blockNumber
		proofSet.BlockHash = eventLog.BlockHash

		if err := h.db.StoreProofSet(ctx, proofSet); err != nil {
			return fmt.Errorf("failed to store proof set: %w", err)
		}
	}
	log.Printf("Successfully updated next_challenge_epoch to %d for proof set %s", nextEpoch, setId)

	return nil
}