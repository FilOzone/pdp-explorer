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

type RootsRemovedHandler struct {
	BaseHandler
	db Database
}

func NewRootsRemovedHandler(db Database) *RootsRemovedHandler {
	return &RootsRemovedHandler{
		BaseHandler: NewBaseHandler(HandlerTypeEvent),
		db:          db,
	}
}

// RootsRemovedHandler handles RootsRemoved events
func (h *RootsRemovedHandler) HandleEvent(ctx context.Context, eventLog *types.Log, tx *types.Transaction) error {
	// Parse setId from topics
	setId, err := getSetIdFromTopic(eventLog.Topics[1])
	if err != nil {
		return fmt.Errorf("failed to parse setId from topics: %w", err)
	}

	// Parse event data
	data := hexToBytes(eventLog.Data)
	if len(data) < 32 { // minimum length for setId and array length
		return fmt.Errorf("invalid data length for RootsRemoved event")
	}

	// Offset to array data
	offsetToArrayData := new(big.Int).SetBytes(data[:32]).Uint64()

	// Extract array length from 32 bytes
	arrayLen := new(big.Int).SetBytes(data[offsetToArrayData : offsetToArrayData+32]).Uint64()

	if len(data) < int(offsetToArrayData+(arrayLen*32)) {
		return fmt.Errorf("invalid data length for rootIds array")
	}

	// Extract rootIds array
	rootIds := make([]*big.Int, arrayLen)
	for i := uint64(0); i < arrayLen; i++ {
		start := 32 + offsetToArrayData + (i * 32)
		end := start + 32
		rootIds[i] = new(big.Int).SetBytes(data[start:end])
	}

	createdAt := time.Unix(eventLog.Timestamp, 0)

	// Store event log
	dbEventData, err := json.Marshal(map[string]interface{}{
		"setId":    setId.String(),
		"root_ids": rootIds,
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
		Name:            "RootsRemoved",
		Address:         eventLog.Address,
		Data:            poolType.JSONText(dbEventData),
		Removed:         eventLog.Removed,
		Topics:          eventLog.Topics,
		LogIndex:        hexToInt64(eventLog.LogIndex),
		TransactionHash: eventLog.TransactionHash,
		CreatedAt:       createdAt,
	}

	if err := h.db.StoreEventLog(ctx, dbEventLog); err != nil {
		return fmt.Errorf("failed to store event log: %w", err)
	}

	// Update each root's removed status and calculate total data size
	totalDataSize := big.NewInt(0)
	for _, rootId := range rootIds {
		rootIdInt := rootId.Int64()
		// First get the root to get its raw_size
		root, err := h.db.FindRoot(ctx, setId.Int64(), rootIdInt)
		if err != nil {
			return fmt.Errorf("[Pieces Removed] failed to find root: %w", err)
		}

		if root != nil {
			totalDataSize.Add(totalDataSize, big.NewInt(root.RawSize))

			root.Removed = true
			root.UpdatedAt = createdAt
			root.BlockNumber = blockNumber
			root.BlockHash = eventLog.BlockHash

			if err := h.db.StoreRoot(ctx, root); err != nil {
				return fmt.Errorf("failed to update root: %w", err)
			}
		}
	}

	// Update proof set total_roots and total_data_size
	proofSets, err := h.db.FindProofSet(ctx, setId.Int64(), false)
	if err != nil {
		return fmt.Errorf("failed to find proof set: %w", err)
	}

	if len(proofSets) != 0 {
		proofSet := proofSets[0]

		proofSet.TotalRoots -= int64(len(rootIds))
		proofSet.UpdatedAt = createdAt
		if proofSet.TotalDataSize.Cmp(totalDataSize) >= 0 {
			proofSet.TotalDataSize.Sub(proofSet.TotalDataSize, totalDataSize)
		} else {
			proofSet.TotalDataSize.SetInt64(0)
		}

		proofSet.BlockNumber = blockNumber
		proofSet.BlockHash = eventLog.BlockHash
		if err := h.db.StoreProofSet(ctx, proofSet); err != nil {
			return fmt.Errorf("failed to store proof set: %w", err)
		}
	}

	providers, err := h.db.FindProvider(ctx, tx.From, false)
	if err != nil {
		return fmt.Errorf("failed to find provider: %w", err)
	}

	if len(providers) != 0 {
		provider := providers[0]

		provider.UpdatedAt = createdAt
		if provider.TotalDataSize.Cmp(totalDataSize) >= 0 {
			provider.TotalDataSize.Sub(provider.TotalDataSize, totalDataSize)
		} else {
			provider.TotalDataSize.SetInt64(0)
		}

		provider.BlockNumber = blockNumber
		provider.BlockHash = eventLog.BlockHash
		if err := h.db.StoreProvider(ctx, provider); err != nil {
			return fmt.Errorf("failed to store provider: %w", err)
		}
	}

	return nil
}
