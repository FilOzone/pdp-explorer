package handlers

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"strings"
	"time"

	"pdp-explorer-indexer/internal/contract"
	"pdp-explorer-indexer/internal/models"
	"pdp-explorer-indexer/internal/types"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/ethereum/go-ethereum/rpc"
	poolType "github.com/jmoiron/sqlx/types"
	"golang.org/x/crypto/sha3"
)

type FaultRecordHandler struct {
	BaseHandler
	db          Database
	pdpVerifier *contract.PDPVerifier
}

func NewFaultRecordHandler(db Database, contractAddress string, lotusAPIEndpoint string) *FaultRecordHandler {
	handler := &FaultRecordHandler{
		BaseHandler: NewBaseHandler(HandlerTypeEvent),
		db:          db,
	}

	// Initialize PDPVerifier contract if address is provided
	if contractAddress != "" {

		// Create custom HTTP client with auth header
		httpClient := &http.Client{}

		// Create a custom RPC client with the API key
		rpcClient, err := rpc.DialOptions(context.Background(), lotusAPIEndpoint, rpc.WithHTTPClient(httpClient))
		if err != nil {
			fmt.Printf("Failed to connect to Lotus API: %v\n", err)
			return nil
		}

		// Add authorization header to all requests via the RPC client
		if apiKey := os.Getenv("LOTUS_API_KEY"); apiKey != "" {
			rpcClient.SetHeader("Authorization", "Bearer "+apiKey)
		}

		// Create ethclient with our authenticated RPC client
		eClient := ethclient.NewClient(rpcClient)
		defer eClient.Close()
		// Convert address string to common.Address
		address := common.HexToAddress(contractAddress)

		// Initialize the contract
		pdpVerifier, err := contract.NewPDPVerifier(address, eClient)
		if err != nil {
			// Log the error but continue - we'll handle missing contract gracefully
			fmt.Printf("Failed to initialize PDPVerifier contract: %v\n", err)
		} else {
			handler.pdpVerifier = pdpVerifier
		}
	}

	return handler
}

// FaultRecordHandler handle FaultRecord events on PDPServiceListener
// event Def - FaultRecord(uint256 indexed proofSetId, uint256 periodsFaulted, uint256 deadline)
// function in which FaultRecord is emitted - nextProvingPeriod(uint256 proofSetId, uint256 challengeEpoch, uint256 /*leafCount*/, bytes calldata)
func (h *FaultRecordHandler) HandleEvent(ctx context.Context, eventLog *types.Log, tx *types.Transaction) error {
	// Parse setId from topics
	setId, err := getSetIdFromTopic(eventLog.Topics[1])
	if err != nil {
		return fmt.Errorf("failed to parse setId from topics: %w", err)
	}

	data := strings.TrimPrefix(eventLog.Data, "0x")
	if len(data) < 64 { // at least one uint256 for periodsFaulted and deadline
		return fmt.Errorf("invalid data length for FaultRecord event")
	}

	periodsFaulted, err := getUint256FromData(data, 0)
	if err != nil {
		return fmt.Errorf("failed to parse periodsFaulted from data: %w", err)
	}

	deadline, err := getUint256FromData(data, 64)
	if err != nil {
		return fmt.Errorf("failed to parse deadline from data: %w", err)
	}

	nextChallengeEpoch, err := getUint256FromData(tx.Input[10:], 64)
	if err != nil {
		return fmt.Errorf("failed to parse challengeEpoch from data: %w", err)
	}

	faultedAt := time.Unix(eventLog.Timestamp, 0)

	dbEventData, err := json.Marshal(map[string]interface{}{
		"proofSetId":     setId.String(),
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
		SetId:           setId.Int64(),
		Name:            "FaultRecord",
		Data:            poolType.JSONText(dbEventData),
		Removed:         eventLog.Removed,
		Address:         eventLog.Address,
		LogIndex:        hexToInt64(eventLog.LogIndex),
		TransactionHash: eventLog.TransactionHash,
		Topics:          eventLog.Topics,
		CreatedAt:       faultedAt,
	}

	if err := h.db.StoreEventLog(ctx, dbEventLog); err != nil {
		return fmt.Errorf("failed to store event log: %w", err)
	}

	// Update proof set stats
	proofSets, err := h.db.FindProofSet(ctx, setId.Int64(), false)
	if err != nil {
		return fmt.Errorf("failed to find proof set: %w", err)
	}
	if len(proofSets) == 0 {
		return nil
	}
	proofSet := proofSets[0]

	challengeEpoch := proofSet.NextChallengeEpoch
	proofSetOwner := proofSet.Owner
	totalLeaves := proofSet.ChallengeRange

	proofSet.TotalFaultedPeriods += periodsFaulted.Int64()
	proofSet.UpdatedAt = faultedAt
	proofSet.BlockNumber = blockNumber
	proofSet.BlockHash = eventLog.BlockHash

	if err := h.db.StoreProofSet(ctx, proofSet); err != nil {
		return fmt.Errorf("failed to store proof set: %w", err)
	}

	providers, err := h.db.FindProvider(ctx, proofSetOwner, false)
	if err != nil {
		return fmt.Errorf("failed to find provider: %w", err)
	}
	if len(providers) != 0 {
		provider := providers[0]

		provider.TotalFaultedPeriods += periodsFaulted.Int64()
		provider.UpdatedAt = faultedAt
		provider.BlockNumber = blockNumber
		provider.BlockHash = eventLog.BlockHash

		if err := h.db.StoreProvider(ctx, provider); err != nil {
			return fmt.Errorf("failed to store provider: %w", err)
		}
	}

	// Get challenged roots
	challengedRoots, err := h.findChallengedRoots(ctx, setId, big.NewInt(challengeEpoch), uint64(totalLeaves))
	if err != nil {
		return fmt.Errorf("failed to find challenged roots: %w", err)
	}
	fmt.Printf("[Fault Record] challenged roots: %v\n", challengedRoots)

	// Use a map to deduplicate root IDs
	uniqueRootIds := make(map[int64]bool)
	for _, rootIdInt := range challengedRoots {
		uniqueRootIds[rootIdInt] = true
	}

	rootIds := make([]int64, 0, len(uniqueRootIds))
	// Process each unique root ID
	for rootIdInt := range uniqueRootIds {
		rootIds = append(rootIds, rootIdInt)

		rootId := new(big.Int).SetInt64(rootIdInt)

		// Update root stats
		root, err := h.db.FindRoot(ctx, setId.Int64(), rootId.Int64())
		if err != nil {
			return fmt.Errorf("[Fault Record] failed to find root (%d, %d): %w", setId.Int64(), rootId.Int64(), err)
		}

		if root != nil {
			root.TotalPeriodsFaulted += periodsFaulted.Int64()
			root.LastFaultedEpoch = int64(blockNumber)
			root.LastFaultedAt = &faultedAt
			root.UpdatedAt = faultedAt
			root.BlockNumber = blockNumber
			root.BlockHash = eventLog.BlockHash

			if err := h.db.StoreRoot(ctx, root); err != nil {
				return fmt.Errorf("failed to store root: %w", err)
			}
		}
	}

	// Store fault record for this specific root
	faultRecord := &models.FaultRecord{
		ReorgModel: models.ReorgModel{
			BlockNumber: blockNumber,
			BlockHash:   eventLog.BlockHash,
		},
		SetId:                 setId.Int64(),
		RootIds:               rootIds,
		CurrentChallengeEpoch: challengeEpoch,
		NextChallengeEpoch:    nextChallengeEpoch.Int64(),
		PeriodsFaulted:        periodsFaulted.Int64(),
		Deadline:              deadline.Int64(),
		CreatedAt:             faultedAt,
	}

	if err := h.db.StoreFaultRecords(ctx, faultRecord); err != nil {
		return fmt.Errorf("failed to store fault record: %w", err)
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

// findChallengedRoots replicates the on-chain challenge selection logic to figure out
// which root IDs are challenged this period for the given proof set.
func (h *FaultRecordHandler) findChallengedRoots(
	ctx context.Context,
	proofSetID, nextChallengeEpoch *big.Int, totalLeaves uint64,
) ([]int64, error) {

	callOpts := &bind.CallOpts{Context: ctx}

	// Fetch chain randomness from the Filecoin beacon at nextChallengeEpoch
	seedInt, err := h.pdpVerifier.GetRandomness(callOpts, nextChallengeEpoch)
	if err != nil {
		return nil, fmt.Errorf("failed to get chain randomness: %w", err)
	}
	seed := seedInt.Bytes()
	if len(seed) == 0 {
		return nil, fmt.Errorf("no randomness returned (seed empty)")
	}

	if totalLeaves == 0 {
		// No leaves means no roots to challenge, seems like this will never happen *shrug*
		return nil, nil
	}

	// Generate each random leaf index
	challenges := make([]*big.Int, contract.NumChallenges)
	for i := 0; i < contract.NumChallenges; i++ {
		leafIdx := h.generateChallengeIndex(seed, proofSetID.Int64(), i, totalLeaves)
		challenges[i] = big.NewInt(leafIdx)
	}

	// For each challenged leaf index, ask the contract which root covers it
	rootIds, err := h.pdpVerifier.FindRootIds(callOpts, proofSetID, challenges)
	if err != nil {
		return nil, fmt.Errorf("failed to find root IDs: %w", err)
	}

	// Convert root ID results to a list of strings
	roots := make([]int64, len(rootIds))
	for i, r := range rootIds {
		roots[i] = r.RootId.Int64()
	}
	return roots, nil
}

// generateChallengeIndex reproduces the code you showed, hashing seed+setID+index
// then modding by totalLeaves to pick a random leaf index.
func (h *FaultRecordHandler) generateChallengeIndex(
	seed []byte,
	proofSetID int64,
	proofIndex int,
	totalLeaves uint64,
) int64 {
	// Build a buffer: seed (32 bytes) + proofSetID(32 bytes) + proofIndex(8 bytes)
	// ProofSetID => 32 bytes big-endian
	// proofIndex => 8 bytes big-endian

	data := make([]byte, 0, 32+32+8)
	data = append(data, seed...)

	// pad proofSetID -> 32 bytes
	psIDBig := big.NewInt(proofSetID)
	psBytes := padTo32Bytes(psIDBig.Bytes())
	data = append(data, psBytes...)

	// proofIndex -> 8 bytes big-endian
	idxBytes := make([]byte, 8)
	binary.BigEndian.PutUint64(idxBytes, uint64(proofIndex))
	data = append(data, idxBytes...)

	// Keccak-256
	hash := sha3.NewLegacyKeccak256()
	hash.Write(data)
	hashBytes := hash.Sum(nil)

	// Convert hash to big.Int, then mod totalLeaves
	hashInt := new(big.Int).SetBytes(hashBytes)
	mod := new(big.Int).SetUint64(totalLeaves)
	challengeIndex := new(big.Int).Mod(hashInt, mod)

	return challengeIndex.Int64()
}

// padTo32Bytes pads an integer's bytes to 32 bytes with leading zeros.
func padTo32Bytes(b []byte) []byte {
	out := make([]byte, 32)
	copy(out[32-len(b):], b)
	return out
}
