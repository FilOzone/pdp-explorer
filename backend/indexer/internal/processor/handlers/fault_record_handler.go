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

type FaultRecordHandler struct {
	types.BaseHandler
	db Database
}

func NewFaultRecordHandler(db Database) *FaultRecordHandler {
	return &FaultRecordHandler{
		BaseHandler: types.NewBaseHandler(types.HandlerTypeEvent),
		db:          db,
	}
}


// FaultRecordHandler handle FaultRecord events on PDPServiceListener
// event Def - FaultRecord(uint256 indexed proofSetId, uint256 periodsFaulted, uint256 deadline)
// function in which FaultRecord is emitted - nextProvingPeriod(uint256 proofSetId, uint256 challengeEpoch, uint256 /*leafCount*/, bytes calldata)
func (h *FaultRecordHandler) HandleEvent(ctx context.Context, eventLog types.Log, tx *types.Transaction) error {
	log.Printf("Processing FaultRecord event. Data: %s", eventLog.Data)

	// Parse setId from topics
	setId, err := getSetIdFromTopic(eventLog.Topics[1])
	if err != nil {
		return fmt.Errorf("failed to parse setId from topics: %w", err)
	}
	log.Printf("Parsed setId: %s", setId.String())

	data := strings.TrimPrefix(eventLog.Data, "0x")
	if len(data) < 64 { // at least one uint256 for periodsFaulted and deadline
		return fmt.Errorf("invalid data length for FaultRecord event")
	}

	periodsFaulted, err := getUint256FromData(data, 0)
	if err != nil {
		return fmt.Errorf("failed to parse periodsFaulted from data: %w", err)
	}
	log.Printf("Parsed periodsFaulted: %d", periodsFaulted)

	deadline, err := getUint256FromData(data, 32)
	if err != nil {
		return fmt.Errorf("failed to parse deadline from data: %w", err)
	}
	log.Printf("Parsed deadline: %d", deadline)

	challengeEpoch, err := getUint256FromData(data, 64)
	if err != nil {
		return fmt.Errorf("failed to parse challengeEpoch from data: %w", err)
	}
	log.Printf("Parsed challengeEpoch: %d", challengeEpoch)

	faultedAt := time.Unix(eventLog.Timestamp, 0)

	dbEventData, err := json.Marshal(map[string]interface{}{
		"proofSetId":          setId.String(),
		"periodsFaulted": periodsFaulted.Int64(),
		"deadline":       deadline.Int64(),
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
		SetId:       setId.Int64(),
		Name:        "FaultRecord",
		Data:        poolType.JSONText(dbEventData),
		Removed:     eventLog.Removed,
		Address:     eventLog.Address,
		LogIndex:    hexToInt64(eventLog.LogIndex),
		TransactionHash: eventLog.TransactionHash,
		Topics:      eventLog.Topics,
		CreatedAt:   faultedAt,
	}

	if err := h.db.StoreEventLog(ctx, dbEventLog); err != nil {
		return fmt.Errorf("failed to store event log: %w", err)
	}

	faultRecord := &models.FaultRecord{
		ReorgModel: models.ReorgModel{
			BlockNumber: blockNumber,
			BlockHash:   eventLog.BlockHash,
		},
		SetId:          setId.Int64(),
		PeriodsFaulted: periodsFaulted.Int64(),
		Deadline:       deadline.Int64(),
		ChallengeEpoch: challengeEpoch.Int64(),
		CreatedAt:      faultedAt,
	}

	if err := h.db.StoreFaultRecords(ctx, faultRecord); err != nil {
		return fmt.Errorf("failed to store fault record: %w", err)
	}

	timestamp := time.Unix(eventLog.Timestamp, 0)

	// Update proof set stats
	proofSets, err := h.db.FindProofSet(ctx, setId.Int64(), false)
	if err != nil {
		return fmt.Errorf("failed to find proof set: %w", err)
	}
	if len(proofSets) != 0 {
		proofSet := proofSets[0]

		proofSet.TotalFaultedPeriods += periodsFaulted.Int64()
		proofSet.UpdatedAt = timestamp
		proofSet.BlockNumber = blockNumber
		proofSet.BlockHash = eventLog.BlockHash

		if err := h.db.StoreProofSet(ctx, proofSet); err != nil {
			return fmt.Errorf("failed to store proof set: %w", err)
		}
	}

	return nil
}

func getUint256FromData(data string, offset int) (*big.Int, error) {
	data = strings.TrimPrefix(data, "0x")

	value, ok := new(big.Int).SetString(data[offset:offset+64], 16)
	if !ok {
		return nil, fmt.Errorf("failed to parse uint256 from data")
	}

	return value, nil
}