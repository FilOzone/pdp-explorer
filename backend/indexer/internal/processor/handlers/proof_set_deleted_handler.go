package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"time"

	"pdp-explorer-indexer/internal/models"
	"pdp-explorer-indexer/internal/types"

	poolType "github.com/jmoiron/sqlx/types"
)

type ProofSetDeletedHandler struct {
	BaseHandler
	db Database
}

func NewProofSetDeletedHandler(db Database) *ProofSetDeletedHandler {
	return &ProofSetDeletedHandler{
		BaseHandler: NewBaseHandler(HandlerTypeEvent),
		db:          db,
	}
}

// ProofSetDeletedHandler handles ProofSetDeleted events
func (h *ProofSetDeletedHandler) HandleEvent(ctx context.Context, eventLog *types.Log, tx *types.Transaction) error {
	// Parse setId from topics
	setId, err := getSetIdFromTopic(eventLog.Topics[1])
	if err != nil {
		return fmt.Errorf("failed to parse setId from topics: %w", err)
	}

	data := hexToBytes(eventLog.Data)

	deletedLeafCount := new(big.Int).SetBytes(data[:32])

	dbEventData, err := json.Marshal(map[string]interface{}{
		"setId":           setId.String(),
		"deletedLeafCount": deletedLeafCount.String(),
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
		Name:            "ProofSetDeleted",
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

	updatedAt := time.Unix(eventLog.Timestamp, 0)

	proofSets, err := h.db.FindProofSet(ctx, setId.Int64(), false)
	if err != nil {
		return fmt.Errorf("failed to find proof set: %w", err)
	}

	if len(proofSets) != 0 {
		proofSet := proofSets[0]


		providers, err := h.db.FindProvider(ctx, proofSet.Owner, false)
		if err != nil {
			return fmt.Errorf("failed to find provider: %w", err)
		}

		if len(providers) != 0 {
			provider := providers[0]
			
			if provider.TotalDataSize.Cmp(proofSet.TotalDataSize) >= 0 {
				provider.TotalDataSize.Sub(provider.TotalDataSize, proofSet.TotalDataSize)
			} else {
				provider.TotalDataSize.SetInt64(0)
			}
			provider.UpdatedAt = updatedAt
			// remove proof_set id from provider's proof_set_ids if present
			provider.ProofSetIds, _ = RemoveIntFromSlice(provider.ProofSetIds, setId.Int64())
			provider.BlockNumber = blockNumber
			provider.BlockHash = eventLog.BlockHash
			if err := h.db.StoreProvider(ctx, provider); err != nil {
				return fmt.Errorf("failed to store provider: %w", err)
			}
		}

		proofSet.Owner = zeroAddress
		proofSet.TotalRoots = 0
		proofSet.TotalDataSize = big.NewInt(0)
		proofSet.IsActive = false
		proofSet.NextChallengeEpoch = 0
		proofSet.LastProvenEpoch = 0
		proofSet.UpdatedAt = updatedAt
		proofSet.BlockNumber = blockNumber
		proofSet.BlockHash = eventLog.BlockHash
		if err := h.db.StoreProofSet(ctx, proofSet); err != nil {
			return fmt.Errorf("failed to store proof set: %w", err)
		}

	}

	return nil
}