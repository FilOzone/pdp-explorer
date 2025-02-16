package handlers

import (
	"context"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"strings"
	"time"

	"pdp-explorer-indexer/internal/models"
	"pdp-explorer-indexer/internal/types"

	"github.com/ethereum/go-ethereum/accounts/abi"
	poolType "github.com/jmoiron/sqlx/types"
)

type PossessionProvenHandler struct {
	BaseHandler
	db Database
}

func NewPossessionProvenHandler(db Database) *PossessionProvenHandler {
	return &PossessionProvenHandler{
		BaseHandler: NewBaseHandler(HandlerTypeEvent),
		db:          db,
	}
}

// PossessionProvenHandler handles PossessionProven events
// event Def - PossessionProven(uint256 indexed setId, RootIdAndOffset[] challenges)
//
//	 struct RootIdAndOffset {
//		uint256 rootId;
//		uint256 offset;
//	}
//
// function in which PossessionProven is emitted - provePossession(uint256 setId, Proof[] calldata proofs)
//
//	 struct Proof {
//		bytes32 leaf;
//		bytes32[] proof;
//	}
func (h *PossessionProvenHandler) HandleEvent(ctx context.Context, eventLog types.Log, tx *types.Transaction) error {
	log.Printf("Processing PossessionProven event. Data: %s", eventLog.Data)

	// Parse setId from topics
	setId, err := getSetIdFromTopic(eventLog.Topics[1])
	if err != nil {
		return fmt.Errorf("failed to parse setId from topics: %w", err)
	}
	log.Printf("Parsed setId: %s", setId)

	// Parse challenges from event data
	challenges, err := parseChallenges(eventLog.Data)
	if err != nil {
		return fmt.Errorf("failed to parse challenges from event data: %w", err)
	}

	// Parse proofs from transaction input
	proofs, err := parseProofs(tx.Input)
	if err != nil {
		return fmt.Errorf("failed to parse proofs from transaction input: %w", err)
	}

	// Verify we have matching number of challenges and proofs
	if len(challenges) != len(proofs) {
		return fmt.Errorf("mismatch between number of challenges (%d) and proofs (%d)", len(challenges), len(proofs))
	}

	// Store each proof and update stats
	timestamp := time.Unix(int64(eventLog.Timestamp), 0)

	dbEventData, err := json.Marshal(map[string]interface{}{
		"setId": setId.String(),
		"challenges": challenges,
	})
	if err != nil {
		return fmt.Errorf("failed to marshal event data: %w", err)
	}

	blockNumber, err := blockNumberToUint64(eventLog.BlockNumber)
	if err != nil {
		return fmt.Errorf("failed to parse block number: %w", err)
	}

	// Create event log
	dbEventLog := &models.EventLog{
		ReorgModel: models.ReorgModel{
			BlockNumber: blockNumber,
			BlockHash:   eventLog.BlockHash,
		},
		SetId:       setId.Int64(),
		Name:        "PossessionProven",
		Data:        poolType.JSONText(dbEventData),
		Removed:     eventLog.Removed,
		Address:     eventLog.Address,
		LogIndex:    hexToInt64(eventLog.LogIndex),
		TransactionHash: eventLog.TransactionHash,
		Topics:      eventLog.Topics,
		CreatedAt:   timestamp,
	}

	// Store event log
	if err := h.db.StoreEventLog(ctx, dbEventLog); err != nil {
		return fmt.Errorf("failed to store event log: %w", err)
	}

	for i, challenge := range challenges {
		proof := &models.Proof{
			ReorgModel: models.ReorgModel{
				BlockNumber: blockNumber,
				BlockHash:   eventLog.BlockHash,
			},
			SetId:       setId.Int64(),
			RootId:      challenge.RootId.Int64(),
			ProofOffset: challenge.Offset.Int64(),
			LeafHash:    hex.EncodeToString(proofs[i].Leaf),
			MerkleProof: encodeProofToBytes(proofs[i].Proof),
			ProvenAt:    timestamp,
			CreatedAt:   timestamp,
		}

		// Store the proof
		if err := h.db.StoreProof(ctx, proof); err != nil {
			return fmt.Errorf("failed to store proof: %w", err)
		}

		root, err := h.db.FindRoot(ctx, setId.Int64(), challenge.RootId.Int64())
		if err != nil {
			return fmt.Errorf("failed to find root: %w", err)
		}

		log.Printf("root: %v", root)

		if root != nil {
			root.TotalProofs += 100
			root.UpdatedAt = timestamp
			root.BlockNumber = blockNumber
			root.BlockHash = eventLog.BlockHash

			if err := h.db.StoreRoot(ctx, root); err != nil {
				return fmt.Errorf("failed to update root: %w", err)
			}
		}
	}

	// Update proof set stats
	proofSets, err := h.db.FindProofSet(ctx, setId.Int64(), false)
	if err != nil {
		return fmt.Errorf("failed to find proof set: %w", err)
	}
	if len(proofSets) != 0 {
		proofSet := proofSets[0]

		proofSet.TotalProvedRoots += int64(len(challenges))
		proofSet.LastProvenEpoch = int64(blockNumber)
		proofSet.UpdatedAt = timestamp
		proofSet.BlockNumber = blockNumber
		proofSet.BlockHash = eventLog.BlockHash

		if err := h.db.StoreProofSet(ctx, proofSet); err != nil {
			return fmt.Errorf("failed to store proof set: %w", err)
		}
	}

	return nil
}

// parseProofs parses Proof array from transaction input
func parseProofs(input string) ([]ProofData, error) {
	input = strings.TrimPrefix(input, "0x")
	if len(input) < 8+64 { // function selector (4 bytes) + array length (32 bytes)
		return nil, fmt.Errorf("input too short")
	}

	inputData, err := hex.DecodeString(input)
	if err != nil {
		return nil, fmt.Errorf("failed to decode hex: %v", err)
	}

	abiJSON := `[{
    "type": "function",
    "name": "provePossession",
    "inputs": [
      {
        "name": "setId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "proofs",
        "type": "tuple[]",
        "internalType": "struct PDPVerifier.Proof[]",
        "components": [
          {
            "name": "leaf",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "proof",
            "type": "bytes32[]",
            "internalType": "bytes32[]"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "payable"
  }]`

	// Parse the ABI
	abi, err := abi.JSON(strings.NewReader(abiJSON))
	if err != nil {
		return nil, fmt.Errorf("failed to parse ABI: %w", err)
	}

	// Get the function
	method, exists := abi.Methods["provePossession"]
	if !exists {
		return nil, fmt.Errorf("method 'provePossession' not found in ABI")
	}

	// decode
	decodedData, err := method.Inputs.UnpackValues(inputData[4:])
	if err != nil {
		return nil, fmt.Errorf("failed to decode input data: %w", err)
	}

	proofsData, ok := decodedData[1].([]struct {
		Leaf  [32]uint8 `json:"leaf"`
		Proof [][32]uint8 `json:"proof"`
	})
	if !ok {
		return nil, fmt.Errorf("failed to convert proofs to [][]byte, got type %T", decodedData[1])
	}

	var proofs []ProofData
	for _, proofData := range proofsData {
		// Convert each [32]uint8 to []byte
		proofBytes := make([][]byte, len(proofData.Proof))
		for i, p := range proofData.Proof {
			proofBytes[i] = p[:]
		}
		proofs = append(proofs, ProofData{
			Leaf:  proofData.Leaf[:],
			Proof: proofBytes,
		})
	}

	return proofs, nil
}

// parseChallenges parses RootIdAndOffset array from event data
func parseChallenges(data string) ([]RootIdAndOffset, error) {
	// Remove "0x" prefix if present
    if len(data) > 2 && data[:2] == "0x" {
        data = data[2:]
    }
    
    // Decode hex string to bytes
    rawData, err := hex.DecodeString(data)
    if err != nil {
        return nil, fmt.Errorf("failed to decode hex: %v", err)
    }
    
    // First 32 bytes (offset to array)
    offset := new(big.Int).SetBytes(rawData[:32])
    if offset.Uint64() != 32 { // Should be 32 (0x20)
        return nil, fmt.Errorf("invalid offset: %v", offset)
    }
    
    // Next 32 bytes (array length)
    length := new(big.Int).SetBytes(rawData[32:64])
    arrayLen := length.Uint64()
    
    // Parse each RootIdAndOffset struct
    result := make([]RootIdAndOffset, arrayLen)
    for i := uint64(0); i < arrayLen; i++ {
        startIdx := 64 + (i * 64) // Each struct takes 64 bytes (2 * 32)
        
        // Parse rootId
        rootId := new(big.Int).SetBytes(rawData[startIdx : startIdx+32])
        
        // Parse offset
        offset := new(big.Int).SetBytes(rawData[startIdx+32 : startIdx+64])
        
        result[i] = RootIdAndOffset{
            RootId: rootId,
            Offset: offset,
        }
    }
    
    return result, nil
}

// encodeProofToBytes encodes a merkle proof array into a single byte slice
func encodeProofToBytes(proof [][]byte) []byte {
	// Calculate total size needed
	totalSize := 4 // 4 bytes for length prefix
	for _, p := range proof {
		totalSize += 4 + len(p) // 4 bytes length prefix for each element
	}

	// Encode the proof
	result := make([]byte, totalSize)
	binary.BigEndian.PutUint32(result[0:4], uint32(len(proof)))
	offset := 4

	for _, p := range proof {
		binary.BigEndian.PutUint32(result[offset:offset+4], uint32(len(p)))
		offset += 4
		copy(result[offset:], p)
		offset += len(p)
	}

	return result
}