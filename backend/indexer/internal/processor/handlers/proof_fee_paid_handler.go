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

type ProofFeePaidHandler struct {
	BaseHandler
	db Database
}


func NewProofFeePaidHandler(db Database) *ProofFeePaidHandler {
	return &ProofFeePaidHandler{
		BaseHandler: NewBaseHandler(HandlerTypeEvent),
		db:          db,
	}
}

// ProofFeePaidHandler handles ProofFeePaid events
func (h *ProofFeePaidHandler) HandleEvent(ctx context.Context, eventLog *types.Log, tx *types.Transaction) error {
	log.Printf("Processing ProofFeePaid event. Topics: %v, Data: %s", eventLog.Topics, eventLog.Data)

	// Event: ProofFeePaid(uint256 indexed setId, uint256 fee, uint64 price, int32 expo)
	// setId is indexed, so it comes from Topics[1] (Topics[0] is the event signature)
	if len(eventLog.Topics) < 2 {
		return fmt.Errorf("invalid number of topics for ProofFeePaid event: got %d, want at least 2", len(eventLog.Topics))
	}

	// Parse setId from topics
	setId, err := getSetIdFromTopic(eventLog.Topics[1])
	if err != nil {
		return fmt.Errorf("failed to parse setId from topics: %w", err)
	}

	// Parse event data for remaining parameters
	data := hexToBytes(eventLog.Data)
	log.Printf("Decoded data length: %d", len(data))

	// Each non-indexed parameter is padded to 32 bytes in the data field
	// - uint256 fee: 32 bytes
	// - uint64 price: 32 bytes (padded)
	// - int32 expo: 32 bytes (padded)
	// Total: 96 bytes
	if len(data) != 96 {
		log.Printf("Invalid data length for ProofFeePaid event. Expected 96 bytes, got %d bytes", len(data))
		return fmt.Errorf("invalid data length for ProofFeePaid event: got %d bytes", len(data))
	}

	// Extract parameters from data
	fee := new(big.Int).SetBytes(data[0:32])
	price := new(big.Int).SetBytes(data[32:64]).Int64()
	expo := int32(new(big.Int).SetBytes(data[64:96]).Int64())

	log.Printf("Extracted values: setId=%s, fee=%s, price=%d, expo=%d",
		setId.String(), fee.String(), price, expo)

	// Convert timestamp to time.Time
	createdAt := time.Unix(eventLog.Timestamp, 0)

	data, err = json.Marshal(map[string]interface{}{
		"setId": setId.String(),
		"fee":   fee.String(),
		"price": price,
		"expo":  expo,
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
		Name:            "ProofFeePaid",
		Address:         eventLog.Address,
		Data:            poolType.JSONText(data),
		Removed:         eventLog.Removed,
		Topics:          eventLog.Topics,
		LogIndex:        hexToInt64(eventLog.LogIndex),
		TransactionHash: eventLog.TransactionHash,
		CreatedAt:       createdAt,
	}

	// Store event log
	if err := h.db.StoreEventLog(ctx, dbEventLog); err != nil {
		return fmt.Errorf("failed to store event log: %w", err)
	}

	feeId := fmt.Sprintf("%s_%s", eventLog.TransactionHash, eventLog.LogIndex)

	// Create proof fee record
	proofFee := &models.ProofFee{
		ReorgModel: models.ReorgModel{
			BlockNumber: blockNumber,
			BlockHash:   eventLog.BlockHash,
		},
		FeeId:               feeId,
		SetId:               setId.Int64(),
		ProofFee:            fee,
		FilUsdPrice:         price,
		FilUsdPriceExponent: expo,
		CreatedAt:           createdAt,
	}

	log.Printf("Storing proof fee: %+v", proofFee)
	if err := h.db.StoreProofFee(ctx, proofFee); err != nil {
		return fmt.Errorf("failed to store proof fee: %w", err)
	}

	proofSets, err := h.db.FindProofSet(ctx, setId.Int64(), false)
	if err != nil {
		return fmt.Errorf("failed to find proof set: %w", err)
	}
	if len(proofSets) != 0 {
		proofSet := proofSets[0]

		proofSet.TotalFeePaid.Add(fee, proofSet.TotalFeePaid)
		proofSet.UpdatedAt = createdAt
		proofSet.BlockNumber = blockNumber
		proofSet.BlockHash = eventLog.BlockHash

		if err := h.db.StoreProofSet(ctx, proofSet); err != nil {
			return fmt.Errorf("failed to store proof set: %w", err)
		}
	}

	return nil
}