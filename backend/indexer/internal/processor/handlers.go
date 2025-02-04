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

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/jmoiron/sqlx/types"
)

// Database interface for handlers
type Database interface {
	// Provider methods
	StoreProvider(ctx context.Context, provider *Provider) error
	FindProvider(ctx context.Context, address string, includeHistory bool) ([]*Provider, error)
	UpdateProvider(ctx context.Context, provider *Provider) error
	UpdateProviderProofSetIds(ctx context.Context, address string, addSetIds []int64, removeSetIds []int64, blockNumber uint64, blockHash string) error
	UpdateProviderTotalDataSize(ctx context.Context, address string, totalDataSize int64, method string, createdAt time.Time) error

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

type Cid struct {
    Data []byte
}

type RootData struct {
	Root    Cid
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
	if err := h.db.StoreProofFee(ctx, proofFee); err != nil {
		return fmt.Errorf("failed to store proof fee: %w", err)
	}

	return nil
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
	_, rootDataArray, _, err := parseAddRootsInput(tx.Input)
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
	offsetToArrayData := new(big.Int).SetBytes(data[:32]).Uint64()

	arrayLen := new(big.Int).SetBytes(data[offsetToArrayData:offsetToArrayData+32]).Uint64()
	log.Printf("Parsed array length: %d", arrayLen)

	// Extract rootIds array from event data
	eventRootIds := make([]*big.Int, arrayLen)
	for i := uint64(0); i < arrayLen; i++ {
		start := 32 + offsetToArrayData + (i * 32)
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
			Cid:       hex.EncodeToString(rootData.Root.Data),
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

	proofSetOwner := tx.From

	// Update providers total_data_size
	if err := h.db.UpdateProviderTotalDataSize(ctx, proofSetOwner, totalDataSize, "add", createdAt); err != nil {
		return fmt.Errorf("failed to update provider total data size: %w", err)
	}
	log.Printf("Successfully updated provider total data size for %s to %d", proofSetOwner, totalDataSize)

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

	// Offset to array data
	offsetToArrayData := new(big.Int).SetBytes(data[:32]).Uint64()

	// Extract array length from 32 bytes
	arrayLen := new(big.Int).SetBytes(data[offsetToArrayData:offsetToArrayData+32]).Uint64()

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

	// Update provider total_data_size
	if err := h.db.UpdateProviderTotalDataSize(ctx, tx.From, totalDataSize, "subtract", createdAt); err != nil {
		return fmt.Errorf("failed to update provider total data size: %w", err)
	}
	log.Printf("Successfully updated provider total_data_size for address %s", tx.From)

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
