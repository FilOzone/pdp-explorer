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

type ProofSetOwnerChangedHandler struct {
	BaseHandler
	db Database
}

func NewProofSetOwnerChangedHandler(db Database) *ProofSetOwnerChangedHandler {
	return &ProofSetOwnerChangedHandler{
		BaseHandler: BaseHandler{HandlerType: HandlerTypeEvent},
		db:          db,
	}
}

// ProofSetOwnerChangedHandler handles ProofSetOwnerChanged events
// event Def - ProofSetOwnerChanged(uint256 indexed setId, address indexed oldOwner, address indexed newOwner)
func (h *ProofSetOwnerChangedHandler) HandleEvent(ctx context.Context, eventLog *types.Log, tx *types.Transaction) error {
	if len(eventLog.Topics) < 4 {
		return fmt.Errorf("invalid number of topics for ProofSetOwnerChanged event: got %d, want at least 4", len(eventLog.Topics))
	}

	// Parse setId from topics
	setId, err := getSetIdFromTopic(eventLog.Topics[1])
	if err != nil {
		return fmt.Errorf("failed to parse setId from topics: %w", err)
	}

	// Parse old owner from topics
	oldOwner, err := getAddressFromTopic(eventLog.Topics[2])
	if err != nil {
		return fmt.Errorf("failed to parse old owner from event log: %w", err)
	}

	// Parse new owner from topics
	newOwner, err := getAddressFromTopic(eventLog.Topics[3])
	if err != nil {
		return fmt.Errorf("failed to parse new owner from event log: %w", err)
	}

	blockNumber, err := blockNumberToUint64(eventLog.BlockNumber)
	if err != nil {
		return fmt.Errorf("failed to parse block number: %w", err)
	}

	createdAt := time.Unix(eventLog.Timestamp, 0)

	data, err := json.Marshal(map[string]interface{}{
		"setId":    setId.String(),
		"oldOwner": oldOwner,
		"newOwner": newOwner,
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
		Name:            "ProofSetOwnerChanged",
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

	proofSets, err := h.db.FindProofSet(ctx, setId.Int64(), false)
	if err != nil {
		return fmt.Errorf("failed to find proof set: %w", err)
	}

	if len(proofSets) != 0 {
		proofSet := proofSets[0]

		proofSet.Owner = newOwner
		proofSet.UpdatedAt = createdAt
		proofSet.BlockNumber = blockNumber
		proofSet.BlockHash = eventLog.BlockHash
		if err := h.db.StoreProofSet(ctx, proofSet); err != nil {
			return fmt.Errorf("failed to store proof set: %w", err)
		}
	}

	oldProviders, err := h.db.FindProvider(ctx, oldOwner, false)
	if err != nil {
		return fmt.Errorf("failed to find provider: %w", err)
	}

	if len(oldProviders) != 0 {
		provider := oldProviders[0]

		provider.ProofSetIds, _ = RemoveIntFromSlice(provider.ProofSetIds, setId.Int64())
		provider.UpdatedAt = createdAt

		if len(proofSets) != 0 {
			proofSet := proofSets[0]
			if provider.TotalDataSize.Cmp(proofSet.TotalDataSize) >= 0 {
				provider.TotalDataSize.Sub(provider.TotalDataSize, proofSet.TotalDataSize)
			} else {
				provider.TotalDataSize.SetInt64(0)
			}
		}

		provider.BlockNumber = blockNumber
		provider.BlockHash = eventLog.BlockHash
		if err := h.db.StoreProvider(ctx, provider); err != nil {
			return fmt.Errorf("failed to store provider: %w", err)
		}
	}

	newProviders, err := h.db.FindProvider(ctx, newOwner, false)
	if err != nil {
		return fmt.Errorf("failed to find provider: %w", err)
	}

	if len(newProviders) != 0 {
		provider := newProviders[0]

		provider.ProofSetIds = append(provider.ProofSetIds, setId.Int64())
		provider.UpdatedAt = createdAt

		if len(proofSets) != 0 {
			proofSet := proofSets[0]
			provider.TotalDataSize.Add(provider.TotalDataSize, proofSet.TotalDataSize)
		}

		provider.BlockNumber = blockNumber
		provider.BlockHash = eventLog.BlockHash
		if err := h.db.StoreProvider(ctx, provider); err != nil {
			return fmt.Errorf("failed to store provider: %w", err)
		}
	} else {
		totalDataSize := big.NewInt(0)
		if len(proofSets) != 0 {
			proofSet := proofSets[0]
			totalDataSize = proofSet.TotalDataSize
		}
		provider := &models.Provider{
			ReorgModel: models.ReorgModel{
				BlockNumber: blockNumber,
				BlockHash:   eventLog.BlockHash,
			},
			Address:       newOwner,
			ProofSetIds:   []int64{setId.Int64()},
			TotalDataSize: totalDataSize,
			UpdatedAt:     createdAt,
			CreatedAt:     createdAt,
		}

		if err := h.db.StoreProvider(ctx, provider); err != nil {
			return fmt.Errorf("failed to store provider: %w", err)
		}
	}

	return nil
}
