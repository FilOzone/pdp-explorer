package processor

import (
	"context"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"strconv"
	"strings"
	"time"

	"github.com/jmoiron/sqlx/types"
)

// Database interface for handlers
type Database interface {
	// Provider methods
	StoreProvider(ctx context.Context, provider *Provider) error
	FindProvider(ctx context.Context, address string, includeHistory bool) ([]*Provider, error)
	UpdateProvider(ctx context.Context, provider *Provider) error
	UpdateProviderProofSetIds(ctx context.Context, address string, addSetIds []int64, removeSetIds []int64, blockNumber uint64, blockHash string) error

	// ProofSet methods
	StoreProofSet(ctx context.Context, proofSet *ProofSet) error
	FindProofSet(ctx context.Context, setId int64, includeHistory bool) ([]*ProofSet, error)
	UpdateProofSet(ctx context.Context, proofSet *ProofSet) error
	UpdateProofSetOwner(ctx context.Context, setId int64, newOwner string, blockNumber uint64, blockHash string) error
	IncrementTotalRoots(ctx context.Context, setId int64, amount int64, totalDataSize int64, timestamp time.Time) error
	DecrementTotalRoots(ctx context.Context, setId int64, amount int64, totalDataSize int64, timestamp time.Time) error
	MarkProofSetDeleted(ctx context.Context, setId int64, blockNumber uint64, blockHash string, timestamp time.Time) error
	MarkProofSetEmpty(ctx context.Context, setId int64, blockNumber uint64, blockHash string, timestamp time.Time) error
	UpdateNextChallengeEpoch(ctx context.Context, setId int64, nextEpoch int64, blockNumber uint64, blockHash string) error

	// ProofFee methods
	StoreProofFee(ctx context.Context, proofFee *ProofFee) error

	// Root methods
	StoreRoot(ctx context.Context, root *Root) error
	UpdateRootRemoved(ctx context.Context, setId, rootId int64, removed bool, blockNumber uint64, blockHash string, updatedAt time.Time) error
	FindRoot(ctx context.Context, setId, rootId int64) (*Root, error)

	// Proof methods
	StoreProof(ctx context.Context, proof *Proof) error
	UpdateRootProofStats(ctx context.Context, setId int64, rootId int64, blockNumber uint64, blockHash string, timestamp time.Time) error
	UpdateProofSetStats(ctx context.Context, setId int64, proofsSubmitted int64, periodsFaulted int64, blockNumber uint64, blockHash string, timestamp time.Time) error

	// Fault methods
	StoreFaultRecords(ctx context.Context, record *FaultRecord) error

	// Event methods
	StoreEventLog(ctx context.Context, event *EventLog) error

	// Transaction methods
	StoreTransaction(ctx context.Context, transaction *TTransaction) error
}

// BaseModel interface defines methods that all models must implement
type BaseModel interface {
	GetID() int64
	GetBlockNumber() uint64
	GetBlockHash() string
	IsReorgLatest() bool
	GetPreviousID() *int64
	SetPreviousID(id *int64)
	SetLatest(isLatest bool)
}

// ReorgModel provides base fields and methods for reorg handling
type ReorgModel struct {
	ID          int64  `db:"id" json:"id"`
	BlockNumber uint64 `db:"block_number" json:"block_number"`
	BlockHash   string `db:"block_hash" json:"block_hash"`
	PreviousID  *int64 `db:"previous_id" json:"previous_id,omitempty"`
}

// ProofSet represents a proof set in the system
type ProofSet struct {
	ReorgModel                    // Embed ReorgModel to inherit base fields and methods
	SetId               int64     `db:"set_id" json:"set_id"`
	Owner               string    `db:"owner" json:"owner"`
	ListenerAddr        string    `db:"listener_addr" json:"listener_addr"`
	TotalFaultedPeriods int64    `db:"total_faulted_periods" json:"total_faulted_periods"`
	TotalDataSize       int64    `db:"total_data_size" json:"total_data_size"`
	TotalRoots          int64    `db:"total_roots" json:"total_roots"`
	TotalProvedRoots    int64    `db:"total_proved_roots" json:"total_proved_roots"`
	TotalFeePaid        *big.Int    `db:"total_fee_paid" json:"total_fee_paid"`
	LastProvenEpoch     int64    `db:"last_proven_epoch" json:"last_proven_epoch"`
	NextChallengeEpoch  int64    `db:"next_challenge_epoch" json:"next_challenge_epoch"`
	TotalTransactions   int64    `db:"total_transactions" json:"total_transactions"`
	IsActive            bool      `db:"is_active" json:"is_active"`
	CreatedAt           time.Time `db:"created_at" json:"created_at"`
	UpdatedAt           time.Time `db:"updated_at" json:"updated_at"`
}

type Provider struct {
	ReorgModel
	Address             string    `db:"address" json:"address"`
	TotalFaultedPeriods int64    `db:"total_faulted_periods" json:"total_faulted_periods"`
	TotalDataSize       int64    `db:"total_data_size" json:"total_data_size"`
	ProofSetIds         []int64   `db:"proof_set_ids" json:"proof_set_ids"`
	CreatedAt           time.Time `db:"created_at" json:"created_at"`
	UpdatedAt           time.Time `db:"updated_at" json:"updated_at"`
}

type ProofFee struct {
	ReorgModel
	FeeId               string    `db:"fee_id"`
	SetId               int64  `db:"set_id"`
	ProofFee            *big.Int  `db:"proof_fee"`
	FilUsdPrice         int64     `db:"fil_usd_price"`
	FilUsdPriceExponent int32     `db:"fil_usd_price_exponent"`
	CreatedAt           time.Time `db:"created_at"`
}

type Root struct {
	ReorgModel
	SetId            int64     `db:"set_id" json:"set_id"`
	RootId           int64     `db:"root_id" json:"root_id"`
	RawSize          int64    `db:"raw_size" json:"raw_size"`
	Cid              string    `db:"cid" json:"cid"`
	Removed          bool      `db:"removed" json:"removed"`
	TotalProofs      int64    `db:"total_proofs" json:"total_proofs"`
	TotalFaults      int64    `db:"total_faults" json:"total_faults"`
	LastProvenEpoch  int64    `db:"last_proven_epoch" json:"last_proven_epoch"`
	LastFaultedEpoch int64    `db:"last_faulted_epoch" json:"last_faulted_epoch"`
	CreatedAt        time.Time `db:"created_at" json:"created_at"`
	UpdatedAt        time.Time `db:"updated_at" json:"updated_at"`
}

type Proof struct {
	ReorgModel
	SetId       int64  `db:"set_id"`
	RootId      int64  `db:"root_id"`
	ProofOffset int64    `db:"proof_offset"`
	LeafHash    string    `db:"leaf_hash"`
	MerkleProof []byte    `db:"merkle_proof"`
	ProvenAt    time.Time `db:"proven_at"`
	CreatedAt   time.Time `db:"created_at"`
}

type FaultRecord struct {
	ReorgModel
	SetId          int64  `db:"set_id"`
	ChallengeEpoch int64    `db:"challenge_epoch"`
	PeriodsFaulted int64    `db:"periods_faulted"`
	Deadline       int64    `db:"deadline"`
	FaultedAt      time.Time `db:"faulted_at"`
	CreatedAt      time.Time `db:"created_at"`
}

type EventLog struct {
	ReorgModel

	SetId           int64          `db:"set_id"`
	Address         string         `db:"address"`
	Name            string         `db:"name"`
	Data            types.JSONText `db:"data"`
	LogIndex        int64          `db:"log_index"`
	Removed         bool           `db:"removed"`
	Topics          []string       `db:"topics"`
	TransactionHash string         `db:"transaction_hash"`
	CreatedAt       time.Time      `db:"created_at"`
}

type TTransaction struct {
	ReorgModel

	Hash        string    `db:"hash"`
	ProofSetId  int64     `db:"proof_set_id"`
	MessageId   string    `db:"message_id"`
	Height      int64     `db:"height"`
	FromAddress string    `db:"from_address"`
	ToAddress   string    `db:"to_address"`
	Value       int64     `db:"value"`
	Method      string    `db:"method"`
	Status      bool      `db:"status"`
	CreatedAt   time.Time `db:"created_at"`
}

type RootData struct {
	Root    string // CID string
	RawSize *big.Int
}

type ProofSetCreatedHandler struct {
	BaseHandler
	db Database
}

type ProofSetOwnerChangedHandler struct {
	BaseHandler
	db Database
}

type ProofFeePaidHandler struct {
	BaseHandler
	db Database
}

type RootsAddedHandler struct {
	BaseHandler
	db Database
}

type RootsRemovedHandler struct {
	BaseHandler
	db Database
}

type ProofSetDeletedHandler struct {
	BaseHandler
	db Database
}

type ProofSetEmptyHandler struct {
	BaseHandler
	db Database
}

type PossessionProvenHandler struct {
	BaseHandler
	db Database
}

type NextProvingPeriodHandler struct {
	BaseHandler
	db Database
}

type FaultRecordHandler struct {
	BaseHandler
	db Database
}

func NewProofSetCreatedHandler(db Database) *ProofSetCreatedHandler {
	return &ProofSetCreatedHandler{
		BaseHandler: BaseHandler{handlerType: HandlerTypeEvent},
		db:          db,
	}
}

func NewProofSetOwnerChangedHandler(db Database) *ProofSetOwnerChangedHandler {
	return &ProofSetOwnerChangedHandler{
		BaseHandler: BaseHandler{handlerType: HandlerTypeEvent},
		db:          db,
	}
}

func NewProofFeePaidHandler(db Database) *ProofFeePaidHandler {
	return &ProofFeePaidHandler{
		BaseHandler: BaseHandler{handlerType: HandlerTypeEvent},
		db:          db,
	}
}

func NewRootsAddedHandler(db Database) *RootsAddedHandler {
	return &RootsAddedHandler{
		BaseHandler: BaseHandler{handlerType: HandlerTypeEvent},
		db:          db,
	}
}

func NewRootsRemovedHandler(db Database) *RootsRemovedHandler {
	return &RootsRemovedHandler{
		BaseHandler: BaseHandler{handlerType: HandlerTypeEvent},
		db:          db,
	}
}

func NewProofSetDeletedHandler(db Database) *ProofSetDeletedHandler {
	return &ProofSetDeletedHandler{
		BaseHandler: BaseHandler{handlerType: HandlerTypeEvent},
		db:          db,
	}
}

func NewProofSetEmptyHandler(db Database) *ProofSetEmptyHandler {
	return &ProofSetEmptyHandler{
		BaseHandler: BaseHandler{handlerType: HandlerTypeEvent},
		db:          db,
	}
}

func NewPossessionProvenHandler(db Database) *PossessionProvenHandler {
	return &PossessionProvenHandler{
		BaseHandler: BaseHandler{handlerType: HandlerTypeEvent},
		db:          db,
	}
}

func NewNextProvingPeriodHandler(db Database) *NextProvingPeriodHandler {
	return &NextProvingPeriodHandler{
		BaseHandler: BaseHandler{handlerType: HandlerTypeEvent},
		db:          db,
	}
}

func NewFaultRecordHandler(db Database) *FaultRecordHandler {
	return &FaultRecordHandler{
		BaseHandler: BaseHandler{handlerType: HandlerTypeEvent},
		db:          db,
	}
}

// Helper function to parse transaction input data for listenerAddr
func parseTransactionInput(input string) (string, error) {
	// Remove "0x" prefix if present
	input = strings.TrimPrefix(input, "0x")

	// Function selector is first 4 bytes (8 chars), then the address parameter (32 bytes, but address is 20 bytes)
	if len(input) < 72 { // 4 bytes selector + 32 bytes parameter
		return "", fmt.Errorf("transaction input too short")
	}

	// Skip function selector (4 bytes = 8 chars) and first 12 bytes (24 chars) of padding
	listenerAddr := "0x" + input[32:72] // Extract 20 bytes address

	return listenerAddr, nil
}

// Proof sets
func (h *ProofSetCreatedHandler) HandleEvent(ctx context.Context, eventLog Log, tx *Transaction) error {

	// Parse setId from topics
	setId, err := getSetIdFromTopic(eventLog.Topics[1])
	if err != nil {
		return fmt.Errorf("failed to parse setId from topics: %w", err)
	}

	// Parse owner from topics (it's an indexed parameter)
	owner, err := getAddressFromTopic(eventLog.Topics[2])
	if err != nil {
		return fmt.Errorf("failed to parse owner from topics: %w", err)
	}

	// Parse listenerAddr from transaction input
	listenerAddr, err := parseTransactionInput(tx.Input)
	if err != nil {
		return fmt.Errorf("failed to parse transaction input: %w", err)
	}

	// Convert timestamp to time.Time
	createdAt := time.Unix(eventLog.Timestamp, 0)

	// Create new Event Log
	data, err := json.Marshal(map[string]interface{}{
		"setId": setId.String(),
		"owner": owner,
	})
	if err != nil {
		return fmt.Errorf("failed to marshal event data: %w", err)
	}

	dbEventLog := &EventLog{
		ReorgModel: ReorgModel{
			BlockNumber: blockNumberToUint64(eventLog.BlockNumber),
			BlockHash:   eventLog.BlockHash,
		},
		SetId:           setId.Int64(),
		Name:            "ProofSetCreated",
		Address:         eventLog.Address,
		Data:            types.JSONText(data),
		Removed:         eventLog.Removed,
		Topics:          eventLog.Topics,
		LogIndex:        hexToInt64(eventLog.LogIndex),
		TransactionHash: eventLog.TransactionHash,
		CreatedAt:       createdAt,
	}

	if err := h.db.StoreEventLog(ctx, dbEventLog); err != nil {
		return fmt.Errorf("failed to store event log: %w", err)
	}

	// Create new proof set
	proofSet := &ProofSet{
		ReorgModel: ReorgModel{
			BlockNumber: blockNumberToUint64(eventLog.BlockNumber),
			BlockHash:   eventLog.BlockHash,
		},
		SetId:               setId.Int64(),
		Owner:               owner,
		ListenerAddr:        listenerAddr,
		TotalFaultedPeriods: 0,
		TotalDataSize:       0,
		TotalRoots:          0,
		TotalFeePaid:        new(big.Int).SetInt64(0),
		LastProvenEpoch:     0,
		NextChallengeEpoch:  0,
		TotalTransactions:   0,
		IsActive:            true,
		CreatedAt:           createdAt,
	}

	// Store proof set
	if err := h.db.StoreProofSet(ctx, proofSet); err != nil {
		return fmt.Errorf("failed to store proof set: %w", err)
	}

	// Find existing provider
	providers, err := h.db.FindProvider(ctx, owner, false)
	if err != nil {
		return fmt.Errorf("failed to find provider: %w", err)
	}

	setIdInt := setId.Int64()

	if len(providers) == 0 {
		// Create new provider
		provider := &Provider{
			ReorgModel: ReorgModel{
				BlockNumber: blockNumberToUint64(eventLog.BlockNumber),
				BlockHash:   eventLog.BlockHash,
			},
			Address:             owner,
			TotalFaultedPeriods: 0,
			TotalDataSize:       0,
			ProofSetIds:         []int64{setIdInt},
			CreatedAt:           createdAt,
		}

		if err := h.db.StoreProvider(ctx, provider); err != nil {
			return fmt.Errorf("failed to store provider: %w", err)
		}
	} else {
		// Check if setId is already present in provider proof_set_ids
		provider := providers[0]
		for _, id := range provider.ProofSetIds {
			if id == setIdInt {
				return nil
			}
		}

		// Update existing provider's proof_set_ids
		provider.ProofSetIds = append(provider.ProofSetIds, setIdInt)
		provider.BlockNumber = blockNumberToUint64(eventLog.BlockNumber)
		provider.BlockHash = eventLog.BlockHash

		if err := h.db.UpdateProvider(ctx, provider); err != nil {
			return fmt.Errorf("failed to update provider: %w", err)
		}
	}

	return nil
}

// ProofSetOwnerChangedHandler handles ProofSetOwnerChanged events
// event Def - ProofSetOwnerChanged(uint256 indexed setId, address indexed oldOwner, address indexed newOwner)
func (h *ProofSetOwnerChangedHandler) HandleEvent(ctx context.Context, eventLog Log, tx *Transaction) error {
	if len(eventLog.Topics) < 4 {
		return fmt.Errorf("invalid number of topics for ProofSetOwnerChanged event: got %d, want at least 4", len(eventLog.Topics))
	}

	// Parse setId from topics
	setId, err := getSetIdFromTopic(eventLog.Topics[1])
	if err != nil {
		return fmt.Errorf("failed to parse setId from topics: %w", err)
	}
	log.Printf("Parsed setId: %s", setId.String())

	// Parse old owner from topics
	oldOwner, err := getAddressFromTopic(eventLog.Topics[2])
	if err != nil {
		return fmt.Errorf("failed to parse old owner from event log: %w", err)
	}
	log.Printf("Parsed old owner: %s", oldOwner)

	// Parse new owner from topics
	newOwner, err := getAddressFromTopic(eventLog.Topics[3])
	if err != nil {
		return fmt.Errorf("failed to parse new owner from event log: %w", err)
	}
	log.Printf("Parsed new owner: %s", newOwner)

	blockNumber := blockNumberToUint64(eventLog.BlockNumber)

	createdAt := time.Unix(eventLog.Timestamp, 0)

	data, err := json.Marshal(map[string]interface{}{
		"setId": setId.String(),
		"oldOwner": oldOwner,
		"newOwner": newOwner,
	})
	if err != nil {
		return fmt.Errorf("failed to marshal event data: %w", err)
	}

	dbEventLog := &EventLog{
		ReorgModel: ReorgModel{
			BlockNumber: blockNumber,
			BlockHash:   eventLog.BlockHash,
		},
		SetId:           setId.Int64(),
		Name:            "ProofSetOwnerChanged",
		Address:         eventLog.Address,
		Data:            types.JSONText(data),
		Removed:         eventLog.Removed,
		Topics:          eventLog.Topics,
		LogIndex:        hexToInt64(eventLog.LogIndex),
		TransactionHash: eventLog.TransactionHash,
		CreatedAt:       createdAt,
	}

	if err := h.db.StoreEventLog(ctx, dbEventLog); err != nil {
		return fmt.Errorf("failed to store event log: %w", err)
	}

	// Update the proof set owner
	if err := h.db.UpdateProofSetOwner(ctx, setId.Int64(), newOwner, blockNumber, eventLog.BlockHash); err != nil {
		return fmt.Errorf("failed to update proof set owner: %w", err)
	}
	log.Printf("Updated proof set %s owner to %s", setId.String(), newOwner)

	// Remove setId from old owner's provider record
	if err := h.db.UpdateProviderProofSetIds(ctx, oldOwner, nil, []int64{setId.Int64()}, blockNumber, eventLog.BlockHash); err != nil {
		return fmt.Errorf("failed to remove proof set from old owner: %w", err)
	}
	log.Printf("Removed proof set %s from old owner %s", setId.String(), oldOwner)

	// Add setId to new owner's provider record
	if err := h.db.UpdateProviderProofSetIds(ctx, newOwner, []int64{setId.Int64()}, nil, blockNumber, eventLog.BlockHash); err != nil {
		return fmt.Errorf("failed to add proof set to new owner: %w", err)
	}
	log.Printf("Added proof set %s to new owner %s", setId.String(), newOwner)

	return nil
}

// ProofFeePaidHandler handles ProofFeePaid events
func (h *ProofFeePaidHandler) HandleEvent(ctx context.Context, eventLog Log, tx *Transaction) error {
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
	price := int64(new(big.Int).SetBytes(data[32:64]).Uint64())
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

	dbEventLog := &EventLog{
		ReorgModel: ReorgModel{
			BlockNumber: blockNumberToUint64(eventLog.BlockNumber),
			BlockHash:   eventLog.BlockHash,
		},
		SetId:           setId.Int64(),
		Name:            "ProofFeePaid",
		Address:         eventLog.Address,
		Data:            types.JSONText(data),
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
	proofFee := &ProofFee{
		ReorgModel: ReorgModel{
			BlockNumber: blockNumberToUint64(eventLog.BlockNumber),
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
	return h.db.StoreProofFee(ctx, proofFee)
}

// RootsAddedHandler handles RootsAdded events
func (h *RootsAddedHandler) HandleEvent(ctx context.Context, eventLog Log, tx *Transaction) error {
	log.Printf("Processing RootsAdded event. Data: %s, Transaction input: %s", eventLog.Data, tx.Input)

	// Parse setId from topics
	setId, err := getSetIdFromTopic(eventLog.Topics[1])
	if err != nil {
		return fmt.Errorf("failed to parse setId from topics: %w", err)
	}
	log.Printf("Parsed setId: %s", setId.String())

	// Parse transaction input to get RootData array
	rootDataArray, err := parseAddRootsInput(tx.Input)
	if err != nil {
		return fmt.Errorf("failed to parse transaction input: %w", err)
	}
	log.Printf("Parsed %d roots from transaction input", len(rootDataArray))
	for i, rootData := range rootDataArray {
		log.Printf("Root %d: root=%s, rawSize=%d",
			i, rootData.Root, rootData.RawSize.Uint64())
	}

	// Parse event data for rootIds array (for verification)
	data := hexToBytes(eventLog.Data)
	if len(data) < 32 { // minimum length for array length
		return fmt.Errorf("invalid data length for RootsAdded event")
	}

	// Extract array length from 32 bytes
	arrayLen := new(big.Int).SetBytes(data[:32]).Uint64()
	if len(data) < int(32+(arrayLen*32)) {
		return fmt.Errorf("invalid data length for rootIds array")
	}

	// Extract rootIds array from event data
	eventRootIds := make([]*big.Int, arrayLen)
	for i := uint64(0); i < arrayLen; i++ {
		start := 32 + (i * 32)
		end := start + 32
		eventRootIds[i] = new(big.Int).SetBytes(data[start:end])
	}
	log.Printf("Parsed %d rootIds from event data", len(eventRootIds))

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

	dbEventLog := &EventLog{
		ReorgModel: ReorgModel{
			BlockNumber: blockNumberToUint64(eventLog.BlockNumber),
			BlockHash:   eventLog.BlockHash,
		},
		SetId:           setId.Int64(),
		Name:            "RootsAdded",
		Address:         eventLog.Address,
		Data:            types.JSONText(dbEventData),
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
	var totalDataSize int64
	for i, rootData := range rootDataArray {
		rootRawSize := rootData.RawSize.Int64()
		totalDataSize += rootRawSize

		root := &Root{
			ReorgModel: ReorgModel{
				BlockNumber: blockNumberToUint64(eventLog.BlockNumber),
				BlockHash:   eventLog.BlockHash,
			},
			SetId:     setId.Int64(),
			RootId:    eventRootIds[i].Int64(),
			RawSize:   rootRawSize,
			Cid:       rootData.Root,
			Removed:   false,
			CreatedAt: createdAt,
			UpdatedAt: createdAt,
		}

		if err := h.db.StoreRoot(ctx, root); err != nil {
			return fmt.Errorf("failed to store root: %w", err)
		}
	}
	log.Printf("Successfully stored %d roots with total data size %d", len(rootDataArray), totalDataSize)

	// Update proof set total_roots and total_data_size
	if err := h.db.IncrementTotalRoots(ctx, setId.Int64(), int64(len(rootDataArray)), totalDataSize, createdAt); err != nil {
		return fmt.Errorf("failed to increment total roots and data size: %w", err)
	}
	log.Printf("Successfully incremented total_roots by %d and total_data_size by %d", len(rootDataArray), totalDataSize)

	return nil
}

// RootsRemovedHandler handles RootsRemoved events
func (h *RootsRemovedHandler) HandleEvent(ctx context.Context, eventLog Log, tx *Transaction) error {
	log.Printf("Processing RootsRemoved event. Data: %s", eventLog.Data)

	// Parse setId from topics
	setId, err := getSetIdFromTopic(eventLog.Topics[1])
	if err != nil {
		return fmt.Errorf("failed to parse setId from topics: %w", err)
	}
	log.Printf("Parsed setId: %s", setId.String())

	// Parse event data
	data := hexToBytes(eventLog.Data)
	if len(data) < 32 { // minimum length for setId and array length
		return fmt.Errorf("invalid data length for RootsRemoved event")
	}

	// Extract array length from 32 bytes
	arrayLen := new(big.Int).SetBytes(data[:32]).Uint64()

	if len(data) < int(32+(arrayLen*32)) {
		return fmt.Errorf("invalid data length for rootIds array")
	}

	// Extract rootIds array
	rootIds := make([]*big.Int, arrayLen)
	for i := uint64(0); i < arrayLen; i++ {
		start := 32 + (i * 32)
		end := start + 32
		rootIds[i] = new(big.Int).SetBytes(data[start:end])
	}

	createdAt := time.Unix(int64(eventLog.Timestamp), 0)

	// Store event log
	dbEventData, err := json.Marshal(map[string]interface{}{
		"setId":   setId.String(),
		"root_ids": rootIds,
	})
	if err != nil {
		return fmt.Errorf("failed to marshal event data: %w", err)
	}
	dbEventLog := &EventLog{
		ReorgModel: ReorgModel{
			BlockNumber: blockNumberToUint64(eventLog.BlockNumber),
			BlockHash:   eventLog.BlockHash,
		},
		SetId:           setId.Int64(),
		Name:            "RootsRemoved",
		Address:         eventLog.Address,
		Data:            types.JSONText(dbEventData),
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
	var totalDataSize int64
	for _, rootId := range rootIds {
		rootIdInt := rootId.Int64()
		// First get the root to get its raw_size
		root, err := h.db.FindRoot(ctx, setId.Int64(), rootIdInt)
		if err != nil {
			return fmt.Errorf("failed to find root: %w", err)
		}
		totalDataSize += root.RawSize

		// Then update its removed status
		if err := h.db.UpdateRootRemoved(ctx, setId.Int64(), rootIdInt, true,
			blockNumberToUint64(eventLog.BlockNumber), eventLog.BlockHash, createdAt); err != nil {
			return fmt.Errorf("failed to update root removed status: %w", err)
		}
	}
	log.Printf("Successfully marked %d roots as removed with total data size %d", len(rootIds), totalDataSize)

	// Update proof set total_roots and total_data_size
	if err := h.db.DecrementTotalRoots(ctx, setId.Int64(), int64(len(rootIds)), totalDataSize, createdAt); err != nil {
		return fmt.Errorf("failed to decrement total roots and data size: %w", err)
	}
	log.Printf("Successfully decremented total_roots by %d and total_data_size by %d", len(rootIds), totalDataSize)

	return nil
}

// ProofSetDeletedHandler handles ProofSetDeleted events
func (h *ProofSetDeletedHandler) HandleEvent(ctx context.Context, eventLog Log, tx *Transaction) error {
	log.Printf("Processing ProofSetDeleted event. Data: %s", eventLog.Data)

	// Parse setId from topics
	setId, err := getSetIdFromTopic(eventLog.Topics[1])
	if err != nil {
		return fmt.Errorf("failed to parse setId from topics: %w", err)
	}
	log.Printf("Parsed setId: %s", setId.String())

	data := hexToBytes(eventLog.Data)

	deletedLeafCount := new(big.Int).SetBytes(data[:32])

	dbEventData, err := json.Marshal(map[string]interface{}{
		"setId":           setId.String(),
		"deletedLeafCount": deletedLeafCount.String(),
	})
	if err != nil {
		return fmt.Errorf("failed to marshal event data: %w", err)
	}

	dbEventLog := &EventLog{
		ReorgModel: ReorgModel{
			BlockNumber: blockNumberToUint64(eventLog.BlockNumber),
			BlockHash:   eventLog.BlockHash,
		},
		SetId:           setId.Int64(),
		Name:            "ProofSetDeleted",
		Address:         eventLog.Address,
		Data:            types.JSONText(dbEventData),
		Removed:         eventLog.Removed,
		Topics:          eventLog.Topics,
		LogIndex:        hexToInt64(eventLog.LogIndex),
		TransactionHash: eventLog.TransactionHash,
		CreatedAt:       time.Unix(eventLog.Timestamp, 0),
	}

	if err := h.db.StoreEventLog(ctx, dbEventLog); err != nil {
		return fmt.Errorf("failed to store event log: %w", err)
	}

	updatedTimestamp := time.Unix(eventLog.Timestamp, 0)


	// Mark the proof set as deleted with all required field updates:
	// - Update proof set owner to zero address
	// - Update total_roots and total_data_size to 0
	// - Set is_active to false
	// - Set NextChallengeEpoch and lastProvenEpoch to 0
	if err := h.db.MarkProofSetDeleted(ctx, setId.Int64(),
		blockNumberToUint64(eventLog.BlockNumber),
		eventLog.BlockHash,
		updatedTimestamp); err != nil {
		return fmt.Errorf("failed to mark proof set as deleted: %w", err)
	}
	log.Printf("Successfully marked proof set %s as deleted", setId)

	return nil
}

// ProofSetEmptyHandler handles ProofSetEmpty events
func (h *ProofSetEmptyHandler) HandleEvent(ctx context.Context, eventLog Log, tx *Transaction) error {
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

	dbEventLog := &EventLog{
		ReorgModel: ReorgModel{
			BlockNumber: blockNumberToUint64(eventLog.BlockNumber),
			BlockHash:   eventLog.BlockHash,
		},
		SetId:           setId.Int64(),
		Name:            "ProofSetEmpty",
		Address:         eventLog.Address,
		Data:            types.JSONText(dbEventData),
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

	if err := h.db.MarkProofSetEmpty(ctx, setId.Int64(),
		blockNumberToUint64(eventLog.BlockNumber),
		eventLog.BlockHash, updatedAt); err != nil {
		return fmt.Errorf("failed to mark proof set as empty: %w", err)
	}
	log.Printf("Successfully marked proof set %s as empty", setId)

	return nil
}

// NextProvingPeriodHandler handles NextProvingPeriod events
// event Def - NextProvingPeriod(uint256 indexed setId, uint256 challengeEpoch, uint256 /*leafCount*/)
func (h *NextProvingPeriodHandler) HandleEvent(ctx context.Context, eventLog Log, tx *Transaction) error {
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

	dbEventLog := &EventLog{
		ReorgModel: ReorgModel{
			BlockNumber: blockNumberToUint64(eventLog.BlockNumber),
			BlockHash:   eventLog.BlockHash,
		},
		SetId:           setId.Int64(),
		Name:            "NextProvingPeriod",
		Address:         eventLog.Address,
		LogIndex:        hexToInt64(eventLog.LogIndex),
		Data:            types.JSONText(dbEventData),
		Removed:         eventLog.Removed,
		Topics:          eventLog.Topics,
		TransactionHash: eventLog.TransactionHash,
		CreatedAt:       time.Unix(eventLog.Timestamp, 0),
	}

	if err := h.db.StoreEventLog(ctx, dbEventLog); err != nil {
		return fmt.Errorf("failed to store event log: %w", err)
	}

	// updatedAt := time.Unix(int64(eventLog.Timestamp), 0)

	// Update the next_challenge_epoch in the proof set
	if err := h.db.UpdateNextChallengeEpoch(ctx, setId.Int64(), nextEpoch,
		blockNumberToUint64(eventLog.BlockNumber),
		eventLog.BlockHash); err != nil {
		return fmt.Errorf("failed to update next challenge epoch: %w", err)
	}
	log.Printf("Successfully updated next_challenge_epoch to %d for proof set %s", nextEpoch, setId)

	return nil
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
func (h *PossessionProvenHandler) HandleEvent(ctx context.Context, eventLog Log, tx *Transaction) error {
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

	// Create event log
	dbEventLog := &EventLog{
		ReorgModel: ReorgModel{
			BlockNumber: blockNumberToUint64(eventLog.BlockNumber),
			BlockHash:   eventLog.BlockHash,
		},
		SetId:       setId.Int64(),
		Name:        "PossessionProven",
		Data:        types.JSONText(dbEventData),
		Removed:     eventLog.Removed,
		Address:     eventLog.Address,
		LogIndex:    hexToInt64(eventLog.LogIndex),
		TransactionHash: eventLog.TransactionHash,
		Topics:      eventLog.Topics,
	}

	// Store event log
	if err := h.db.StoreEventLog(ctx, dbEventLog); err != nil {
		return fmt.Errorf("failed to store event log: %w", err)
	}

	for i, challenge := range challenges {
		proof := &Proof{
			ReorgModel: ReorgModel{
				BlockNumber: blockNumberToUint64(eventLog.BlockNumber),
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

		// Update root stats
		if err := h.db.UpdateRootProofStats(ctx, setId.Int64(), challenge.RootId.Int64(), blockNumberToUint64(eventLog.BlockNumber), eventLog.BlockHash, timestamp); err != nil {
			return fmt.Errorf("failed to update root stats: %w", err)
		}
	}

	// Update proof set stats
	if err := h.db.UpdateProofSetStats(ctx, setId.Int64(), int64(len(challenges)), 0, blockNumberToUint64(eventLog.BlockNumber), eventLog.BlockHash, timestamp); err != nil {
		return fmt.Errorf("failed to update proof set stats: %w", err)
	}

	return nil
}

// FaultRecordHandler handle FaultRecord events on PDPServiceListener
// event Def - FaultRecord(uint256 indexed proofSetId, uint256 periodsFaulted, uint256 deadline)
// function in which FaultRecord is emitted - nextProvingPeriod(uint256 proofSetId, uint256 challengeEpoch, uint256 /*leafCount*/, bytes calldata)
func (h *FaultRecordHandler) HandleEvent(ctx context.Context, eventLog Log, tx *Transaction) error {
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

	dbEventLog := &EventLog{
		ReorgModel: ReorgModel{
			BlockNumber: blockNumberToUint64(eventLog.BlockNumber),
			BlockHash:   eventLog.BlockHash,
		},
		SetId:       setId.Int64(),
		Name:        "FaultRecord",
		Data:        types.JSONText(dbEventData),
		Removed:     eventLog.Removed,
		Address:     eventLog.Address,
		LogIndex:    hexToInt64(eventLog.LogIndex),
		TransactionHash: eventLog.TransactionHash,
		Topics:      eventLog.Topics,
	}

	if err := h.db.StoreEventLog(ctx, dbEventLog); err != nil {
		return fmt.Errorf("failed to store event log: %w", err)
	}

	faultRecord := &FaultRecord{
		ReorgModel: ReorgModel{
			BlockNumber: blockNumberToUint64(eventLog.BlockNumber),
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
	if err := h.db.UpdateProofSetStats(ctx, setId.Int64(), 0, periodsFaulted.Int64(), blockNumberToUint64(eventLog.BlockNumber), eventLog.BlockHash, timestamp); err != nil {
		return fmt.Errorf("failed to update proof set stats: %w", err)
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

// parseAddRootsInput parses the transaction input data for the addRoots function
func parseAddRootsInput(input string) ([]RootData, error) {
	// Remove "0x" prefix if present
	input = strings.TrimPrefix(input, "0x")

	// Minimum length check: selector(4) + setId(32) + rootDataOffset(32) + extraDataOffset(32) = 100 bytes
	if len(input) < 200 { // 100 bytes in hex
		return nil, fmt.Errorf("input data too short for minimum length: got %d, want >= 200", len(input))
	}

	// Skip function selector (4 bytes) and setId (32 bytes)
	// rootDataOffset starts at byte 36 (72 in hex)
	rootDataOffsetHex := input[72:136]
	rootDataOffset := new(big.Int)
	rootDataOffset.SetString(rootDataOffsetHex, 16)
	log.Printf("Root data offset: %d", rootDataOffset)

	// rootDataOffset points to the start of the array encoding
	// Convert offset to hex string position (multiply by 2)
	arrayStart := rootDataOffset.Int64() * 2

	// Array length is at the offset position
	if len(input) < int(arrayStart+64) { // need 32 bytes (64 hex chars) for length
		return nil, fmt.Errorf("input data too short for array length: got %d, want >= %d",
			len(input), arrayStart+64)
	}

	arrayLenHex := input[arrayStart : arrayStart+64]
	arrayLen := new(big.Int)
	arrayLen.SetString(arrayLenHex, 16)
	log.Printf("Array length: %d", arrayLen)

	// Each RootData element has: root(32) + rawSize(32)
	// First calculate total fixed size: 64 bytes per element
	fixedSize := arrayLen.Int64() * 64 * 2 // multiply by 2 for hex
	if len(input) < int(arrayStart+64+fixedSize) {
		return nil, fmt.Errorf("input data too short for array elements: got %d, want >= %d",
			len(input), arrayStart+64+fixedSize)
	}

	// Parse each RootData element
	rootDataArray := make([]RootData, arrayLen.Int64())
	for i := int64(0); i < arrayLen.Int64(); i++ {
		pos := arrayStart + 64 + (i * 64 * 2) // skip array length and move to current element
		log.Printf("Parsing root data at position %d", pos)

		// Parse root (CID)
		rootBytes, err := hex.DecodeString(input[pos : pos+64])
		if err != nil {
			return nil, fmt.Errorf("failed to decode root CID at index %d: %w", i, err)
		}
		root := string(rootBytes)
		log.Printf("Root %d - root CID: %s", i, root)

		// Parse rawSize
		rawSize := new(big.Int)
		rawSize.SetString(input[pos+64:pos+128], 16)
		log.Printf("Root %d - rawSize: %d", i, rawSize.Uint64())

		rootDataArray[i] = RootData{
			Root:    root,
			RawSize: rawSize,
		}
	}

	return rootDataArray, nil
}

// RootIdAndOffset represents a challenge for a specific root and offset
type RootIdAndOffset struct {
	RootId *big.Int
	Offset *big.Int
}

// ProofData represents a proof submitted for a challenge
type ProofData struct {
	Leaf  []byte
	Proof [][]byte
}

// parseChallenges parses RootIdAndOffset array from event data
func parseChallenges(data string) ([]RootIdAndOffset, error) {
	data = strings.TrimPrefix(data, "0x")
	if len(data) < 64 { // at least one uint256 for array length
		return nil, fmt.Errorf("data too short")
	}

	// First 32 bytes is array length
	length, ok := new(big.Int).SetString(data[:64], 16)
	if !ok {
		return nil, fmt.Errorf("invalid array length")
	}

	challenges := make([]RootIdAndOffset, length.Int64())
	data = data[64:] // skip array length

	// Each RootIdAndOffset has 2 uint256 fields
	for i := int64(0); i < length.Int64(); i++ {
		if len(data) < 128 { // need 64 bytes for each struct
			return nil, fmt.Errorf("data too short for challenge %d", i)
		}

		rootId, ok := new(big.Int).SetString(data[:64], 16)
		if !ok {
			return nil, fmt.Errorf("invalid rootId for challenge %d", i)
		}

		offset, ok := new(big.Int).SetString(data[64:128], 16)
		if !ok {
			return nil, fmt.Errorf("invalid offset for challenge %d", i)
		}

		challenges[i] = RootIdAndOffset{
			RootId: rootId,
			Offset: offset,
		}

		data = data[128:] // move to next struct
	}

	return challenges, nil
}

// parseProofs parses Proof array from transaction input
func parseProofs(input string) ([]ProofData, error) {
	input = strings.TrimPrefix(input, "0x")
	if len(input) < 8+64 { // function selector (4 bytes) + array length (32 bytes)
		return nil, fmt.Errorf("input too short")
	}

	// Skip function selector
	input = input[8:]

	// First 32 bytes is array length
	length, ok := new(big.Int).SetString(input[:64], 16)
	if !ok {
		return nil, fmt.Errorf("invalid array length")
	}

	proofs := make([]ProofData, length.Int64())
	input = input[64:] // skip array length

	for i := int64(0); i < length.Int64(); i++ {
		if len(input) < 64 { // need at least 32 bytes for leaf
			return nil, fmt.Errorf("input too short for proof %d", i)
		}

		// Parse leaf (32 bytes)
		leaf, err := hex.DecodeString(input[:64])
		if err != nil {
			return nil, fmt.Errorf("invalid leaf for proof %d: %w", i, err)
		}

		// Parse proof array
		input = input[64:]   // skip leaf
		if len(input) < 64 { // need at least array length
			return nil, fmt.Errorf("input too short for proof array %d", i)
		}

		proofLength, ok := new(big.Int).SetString(input[:64], 16)
		if !ok {
			return nil, fmt.Errorf("invalid proof array length for proof %d", i)
		}

		input = input[64:] // skip array length
		proofBytes := make([][]byte, proofLength.Int64())

		for j := int64(0); j < proofLength.Int64(); j++ {
			if len(input) < 64 {
				return nil, fmt.Errorf("input too short for proof element %d in proof %d", j, i)
			}

			proofElement, err := hex.DecodeString(input[:64])
			if err != nil {
				return nil, fmt.Errorf("invalid proof element %d in proof %d: %w", j, i, err)
			}

			proofBytes[j] = proofElement
			input = input[64:] // move to next element
		}

		proofs[i] = ProofData{
			Leaf:  leaf,
			Proof: proofBytes,
		}
	}

	return proofs, nil
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

// Helper functions
func hexToBytes(s string) []byte {
	s = strings.TrimPrefix(s, "0x")
	if len(s)%2 == 1 {
		s = "0" + s
	}
	b, err := hex.DecodeString(s)
	if err != nil {
		log.Printf("Error decoding hex string: %v", err)
		return nil
	}
	return b
}

func blockNumberToUint64(blockNumber string) uint64 {
	// Remove "0x" prefix if present
	blockNumber = strings.TrimPrefix(blockNumber, "0x")
	n := new(big.Int)
	n.SetString(blockNumber, 16)
	return n.Uint64()
}

func getSetIdFromTopic(topic string) (*big.Int, error) {
	topic = strings.TrimPrefix(topic, "0x")
	setId := new(big.Int)
	setId.SetString(topic, 16)
	return setId, nil
}

func getAddressFromTopic(topic string) (string, error) {
	hexData := strings.TrimPrefix(topic, "0x")
	addressHex := hexData[24:]
	address := "0x" + addressHex
	return address, nil
}

 func hexToInt64(hex string) int64 {
	val, _ := strconv.ParseInt(strings.TrimPrefix(hex, "0x"), 16, 64)
	return val
}
