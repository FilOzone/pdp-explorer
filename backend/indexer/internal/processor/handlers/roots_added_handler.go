package handlers

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"strings"
	"time"

	"pdp-explorer-indexer/internal/models"
	"pdp-explorer-indexer/internal/types"

	"github.com/ethereum/go-ethereum/accounts/abi"
	cid "github.com/ipfs/go-cid"
	poolType "github.com/jmoiron/sqlx/types"
)

type RootsAddedHandler struct {
	BaseHandler
	db Database
}

func NewRootsAddedHandler(db Database) *RootsAddedHandler {
	return &RootsAddedHandler{
		BaseHandler: NewBaseHandler(HandlerTypeEvent),
		db:          db,
	}
}

// RootsAddedHandler handles RootsAdded events
func (h *RootsAddedHandler) HandleEvent(ctx context.Context, eventLog *types.Log, tx *types.Transaction) error {
	// Parse setId from topics
	setId, err := getSetIdFromTopic(eventLog.Topics[1])
	if err != nil {
		return fmt.Errorf("failed to parse setId from topics: %w", err)
	}

	// Parse transaction input to get RootData array
	_, rootDataArray, _, err := parseAddRootsInput(tx.Input)
	if err != nil {
		return fmt.Errorf("failed to parse transaction input: %w", err)
	}

	// Parse event data for rootIds array (for verification)
	data := hexToBytes(eventLog.Data)
	if len(data) < 32 { // minimum length for array length
		return fmt.Errorf("invalid data length for RootsAdded event")
	}

	// Extract array length from 32 bytes
	offsetToArrayData := new(big.Int).SetBytes(data[:32]).Uint64()

	arrayLen := new(big.Int).SetBytes(data[offsetToArrayData:offsetToArrayData+32]).Uint64()

	// Extract rootIds array from event data
	eventRootIds := make([]*big.Int, arrayLen)
	for i := uint64(0); i < arrayLen; i++ {
		start := 32 + offsetToArrayData + (i * 32)
		end := start + 32
		eventRootIds[i] = new(big.Int).SetBytes(data[start:end])
	}

	// Verify rootIds from event match those in transaction input
	if len(eventRootIds) != len(rootDataArray) {
		return fmt.Errorf("mismatch between event rootIds length (%d) and transaction rootData length (%d)",
			len(eventRootIds), len(rootDataArray))
	}

	// Convert timestamp to time.Time
	createdAt := time.Unix(eventLog.Timestamp, 0)

	dbEventData, err := json.Marshal(map[string]interface{}{
		"setId":   setId.String(),
		"rootIds": eventRootIds,
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
		Name:            "RootsAdded",
		Address:         eventLog.Address,
		Data:            poolType.JSONText(dbEventData),
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

	// Store each root with its complete data
	totalDataSize := big.NewInt(0)
	for i, rootData := range rootDataArray {
		rootRawSize := rootData.RawSize.Int64()
		totalDataSize.Add(totalDataSize, big.NewInt(rootRawSize))

		_, cid, err := cid.CidFromBytes(rootData.Root.Data)
		if err != nil {
			return fmt.Errorf("failed to get cid: %w", err)
		}

		root := &models.Root{
			ReorgModel: models.ReorgModel{
				BlockNumber: blockNumber,
				BlockHash:   eventLog.BlockHash,
			},
			SetId:     setId.Int64(),
			RootId:    eventRootIds[i].Int64(),
			RawSize:   rootRawSize,
			Cid:       cid.String(),
			Removed:   false,
			CreatedAt: createdAt,
			UpdatedAt: createdAt,
		}

		if err := h.db.StoreRoot(ctx, root); err != nil {
			return fmt.Errorf("failed to store root: %w", err)
		}
	}

	proofSets, err := h.db.FindProofSet(ctx, setId.Int64(), false)
	if err != nil {
		return fmt.Errorf("failed to find proof set: %w", err)
	}

	if len(proofSets) != 0 {
		proofSet := proofSets[0]

		proofSet.TotalRoots += int64(len(rootDataArray))
		proofSet.TotalDataSize.Add(proofSet.TotalDataSize, totalDataSize)
		proofSet.UpdatedAt = createdAt
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

		provider.TotalDataSize.Add(provider.TotalDataSize, totalDataSize)
		provider.UpdatedAt = createdAt
		provider.BlockNumber = blockNumber
		provider.BlockHash = eventLog.BlockHash
		if err := h.db.StoreProvider(ctx, provider); err != nil {
			return fmt.Errorf("failed to store provider: %w", err)
		}
	}

	return nil
}

// parseAddRootsInput parses the transaction input data for the addRoots function
func parseAddRootsInput(input string) (setId *big.Int, rootData []RootData, extraData []byte, err error) {
	// Remove "0x" prefix if present
	if len(input) > 2 && input[:2] == "0x" {
		input = input[2:]
	}

	// Decode hex to bytes
	inputData, err := hex.DecodeString(input)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("failed to decode hex input: %w", err)
	}

	// Extract function selector (first 4 bytes)
	if len(inputData) < 4 {
		return nil, nil, nil, fmt.Errorf("invalid transaction input length")
	}
	inputData = inputData[4:] // Remove selector

	abiJSON := `[{
    "type": "function",
    "name": "addRoots",
    "inputs": [
      {
        "name": "setId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "rootData",
        "type": "tuple[]",
        "internalType": "struct PDPVerifier.RootData[]",
        "components": [
          {
            "name": "root",
            "type": "tuple",
            "internalType": "struct Cids.Cid",
            "components": [
              {
                "name": "data",
                "type": "bytes",
                "internalType": "bytes"
              }
            ]
          },
          {
            "name": "rawSize",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      },
      {
        "name": "extraData",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  }]`

	// Parse ABI
	parsedABI, err := abi.JSON(strings.NewReader(abiJSON))
	if err != nil {
		return nil, nil, nil, fmt.Errorf("failed to parse ABI: %w", err)
	}

	// Decode input
	method, exists := parsedABI.Methods["addRoots"]
	if !exists {
		return nil, nil, nil, fmt.Errorf("method addRoots not found in ABI")
	}

	decodedData, err := method.Inputs.UnpackValues(inputData)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("failed to decode input: %w", err)
	}

	// Extract setId
	setId, ok := decodedData[0].(*big.Int)
	if !ok {
		return nil, nil, nil, fmt.Errorf("invalid setId type")
	}

	// Extract rootData
	rawRootData, ok := decodedData[1].([]struct {
		Root       struct {
			Data []uint8 `json:"data"`
		} `json:"root"`
		RawSize    *big.Int `json:"rawSize"`
	})
	if !ok {
		return nil, nil, nil, fmt.Errorf("invalid rootData type")
	}

	for _, root := range rawRootData {
		rootData = append(rootData, RootData{
			Root:    Cid{Data: root.Root.Data},
			RawSize: root.RawSize,
		})
	}

	// Extract extraData
	extraData, ok = decodedData[2].([]byte)
	if !ok {
		return nil, nil, nil, fmt.Errorf("invalid extraData type")
	}

	return setId, rootData, extraData, nil
}