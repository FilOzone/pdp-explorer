package processor

import (
	"context"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
)

// Database interface defines methods needed by handlers
type Database interface {
	StoreProofSet(ctx context.Context, proofSet *ProofSet) error
	UpdateProofSet(ctx context.Context, setID string, updates map[string]interface{}) error
	StoreProofFee(ctx context.Context, fee *ProofFee) error
	StoreFaultRecord(ctx context.Context, record *FaultRecord) error
	StoreTransfer(ctx context.Context, transfer *Transfer) error
}

// ProofSet represents a proof set in the database
type ProofSet struct {
	SetID      string    `json:"set_id"`
	Status     string    `json:"status"`
	CreatedAt  uint64    `json:"created_at"`
	TxHash     string    `json:"tx_hash"`
	FirstRoot  *big.Int  `json:"first_root,omitempty"`
	NumRoots   uint64    `json:"num_roots,omitempty"`
}

// ProofFee represents a proof fee payment
type ProofFee struct {
	SetID      string    `json:"set_id"`
	Fee        *big.Int  `json:"fee"`
	Price      uint64    `json:"price"`
	Exponent   int32     `json:"exponent"`
	TxHash     string    `json:"tx_hash"`
	BlockNumber uint64   `json:"block_number"`
}

// FaultRecord represents a fault record
type FaultRecord struct {
	ProofSetID     string    `json:"proof_set_id"`
	PeriodsFaulted *big.Int  `json:"periods_faulted"`
	Deadline       *big.Int  `json:"deadline"`
	TxHash         string    `json:"tx_hash"`
	BlockNumber    uint64    `json:"block_number"`
}

// DealProposal represents a deal proposal in the database
type DealProposal struct {
	DealID      string
	Provider    string
	Client      string
	Size        *big.Int
	Price       *big.Int
	StartEpoch  uint64
	EndEpoch    uint64
	Status      string
	CreatedAt   uint64
	TxHash      string
}

// Transfer represents a WFIL transfer
type Transfer struct {
	FromAddress  string   `json:"from_address"`
	ToAddress    string   `json:"to_address"`
	Amount       *big.Int `json:"amount"`
	TxHash      string   `json:"tx_hash"`
	BlockNumber uint64   `json:"block_number"`
	LogIndex    string   `json:"log_index"`
}

// Handler implementations
type ProofSetCreatedHandler struct {
	db Database
}

type ProofSetDeletedHandler struct {
	db Database
}

type RootsAddedHandler struct {
	db Database
}

type RootsRemovedHandler struct {
	db Database
}

type ProofFeePaidHandler struct {
	db Database
}

type ProofSetEmptyHandler struct {
	db Database
}

type FaultRecordHandler struct {
	db Database
}

type DealProposalHandler struct {
	db Database
}

type DealCommittedHandler struct {
	db Database
}

type DealActivatedHandler struct {
	db Database
}

type DealTerminatedHandler struct {
	db Database
}

type TransferHandler struct {
	db Database
}

// Constructor functions
func NewProofSetCreatedHandler(db Database) *ProofSetCreatedHandler {
	return &ProofSetCreatedHandler{db: db}
}

func NewProofSetDeletedHandler(db Database) *ProofSetDeletedHandler {
	return &ProofSetDeletedHandler{db: db}
}

func NewRootsAddedHandler(db Database) *RootsAddedHandler {
	return &RootsAddedHandler{db: db}
}

func NewRootsRemovedHandler(db Database) *RootsRemovedHandler {
	return &RootsRemovedHandler{db: db}
}

func NewProofFeePaidHandler(db Database) *ProofFeePaidHandler {
	return &ProofFeePaidHandler{db: db}
}

func NewProofSetEmptyHandler(db Database) *ProofSetEmptyHandler {
	return &ProofSetEmptyHandler{db: db}
}

func NewFaultRecordHandler(db Database) *FaultRecordHandler {
	return &FaultRecordHandler{db: db}
}

func NewDealProposalHandler(db Database) *DealProposalHandler {
	return &DealProposalHandler{db: db}
}

func NewDealCommittedHandler(db Database) *DealCommittedHandler {
	return &DealCommittedHandler{db: db}
}

func NewDealActivatedHandler(db Database) *DealActivatedHandler {
	return &DealActivatedHandler{db: db}
}

func NewDealTerminatedHandler(db Database) *DealTerminatedHandler {
	return &DealTerminatedHandler{db: db}
}

func NewTransferHandler(db Database) *TransferHandler {
	return &TransferHandler{db: db}
}

// Handle implementations
func (h *ProofSetCreatedHandler) Handle(ctx context.Context, log Log) error {
	data := strings.TrimPrefix(log.Data, "0x")
	if len(data) < 64 { // 1 parameter * 32 bytes
		return fmt.Errorf("invalid data length for ProofSetCreated")
	}

	setID := new(big.Int).SetBytes(hexToBytes(data[:64])).String()
	
	proofSet := &ProofSet{
		SetID:     setID,
		Status:    "created",
		CreatedAt: blockNumberToUint64(log.BlockNumber),
		TxHash:    log.TransactionHash,
	}

	return h.db.StoreProofSet(ctx, proofSet)
}

func (h *ProofSetDeletedHandler) Handle(ctx context.Context, log Log) error {
	data := strings.TrimPrefix(log.Data, "0x")
	if len(data) < 64 {
		return fmt.Errorf("invalid data length for ProofSetDeleted")
	}

	setID := new(big.Int).SetBytes(hexToBytes(data[:64])).String()
	updates := map[string]interface{}{
		"status": "deleted",
	}

	return h.db.UpdateProofSet(ctx, setID, updates)
}

func (h *RootsAddedHandler) Handle(ctx context.Context, log Log) error {
	data := strings.TrimPrefix(log.Data, "0x")
	if len(data) < 128 { // 2 parameters * 32 bytes
		return fmt.Errorf("invalid data length for RootsAdded")
	}

	setID := new(big.Int).SetBytes(hexToBytes(data[:64])).String()
	firstAdded := new(big.Int).SetBytes(hexToBytes(data[64:128]))

	updates := map[string]interface{}{
		"first_root": firstAdded,
	}

	return h.db.UpdateProofSet(ctx, setID, updates)
}

func (h *RootsRemovedHandler) Handle(ctx context.Context, log Log) error {
	data := strings.TrimPrefix(log.Data, "0x")
	if len(data) < 128 {
		return fmt.Errorf("invalid data length for RootsRemoved")
	}

	setID := new(big.Int).SetBytes(hexToBytes(data[:64])).String()
	firstRemoved := new(big.Int).SetBytes(hexToBytes(data[64:128]))

	updates := map[string]interface{}{
		"first_removed": firstRemoved,
	}

	return h.db.UpdateProofSet(ctx, setID, updates)
}

func (h *ProofFeePaidHandler) Handle(ctx context.Context, log Log) error {
	if len(log.Topics) < 2 {
		return fmt.Errorf("invalid topics length for ProofFeePaid")
	}

	data := strings.TrimPrefix(log.Data, "0x")
	if len(data) < 160 { // 3 parameters * 32 bytes (fee, price, expo)
		return fmt.Errorf("invalid data length for ProofFeePaid")
	}

	setID := new(big.Int).SetBytes(hexToBytes(log.Topics[1][2:])).String() // indexed parameter
	fee := new(big.Int).SetBytes(hexToBytes(data[:64]))
	price := new(big.Int).SetBytes(hexToBytes(data[64:128])).Uint64()
	expo := int32(new(big.Int).SetBytes(hexToBytes(data[128:160])).Int64())

	proofFee := &ProofFee{
		SetID:       setID,
		Fee:         fee,
		Price:       price,
		Exponent:    expo,
		TxHash:      log.TransactionHash,
		BlockNumber: blockNumberToUint64(log.BlockNumber),
	}

	return h.db.StoreProofFee(ctx, proofFee)
}

func (h *ProofSetEmptyHandler) Handle(ctx context.Context, log Log) error {
	data := strings.TrimPrefix(log.Data, "0x")
	if len(data) < 64 {
		return fmt.Errorf("invalid data length for ProofSetEmpty")
	}

	setID := new(big.Int).SetBytes(hexToBytes(data[:64])).String()
	updates := map[string]interface{}{
		"status": "empty",
	}

	return h.db.UpdateProofSet(ctx, setID, updates)
}

func (h *FaultRecordHandler) Handle(ctx context.Context, log Log) error {
	if len(log.Topics) < 2 {
		return fmt.Errorf("invalid topics length for FaultRecord")
	}

	data := strings.TrimPrefix(log.Data, "0x")
	if len(data) < 128 { // 2 parameters * 32 bytes (periodsFaulted, deadline)
		return fmt.Errorf("invalid data length for FaultRecord")
	}

	proofSetID := new(big.Int).SetBytes(hexToBytes(log.Topics[1][2:])).String() // indexed parameter
	periodsFaulted := new(big.Int).SetBytes(hexToBytes(data[:64]))
	deadline := new(big.Int).SetBytes(hexToBytes(data[64:128]))

	faultRecord := &FaultRecord{
		ProofSetID:     proofSetID,
		PeriodsFaulted: periodsFaulted,
		Deadline:       deadline,
		TxHash:         log.TransactionHash,
		BlockNumber:    blockNumberToUint64(log.BlockNumber),
	}

	return h.db.StoreFaultRecord(ctx, faultRecord)
}

func (h *TransferHandler) Handle(ctx context.Context, log Log) error {
	if len(log.Topics) != 3 {
		return fmt.Errorf("invalid topics length for Transfer event")
	}

	// Parse from and to addresses (they are indexed parameters)
	fromAddress := strings.ToLower(fmt.Sprintf("0x%s", log.Topics[1][26:])) // Remove padding
	toAddress := strings.ToLower(fmt.Sprintf("0x%s", log.Topics[2][26:]))   // Remove padding

	// Parse amount from data
	data := strings.TrimPrefix(log.Data, "0x")
	if len(data) < 64 { // 1 parameter * 32 bytes
		return fmt.Errorf("invalid data length for Transfer")
	}

	amount := new(big.Int).SetBytes(hexToBytes(data[:64]))

	transfer := &Transfer{
		FromAddress:  fromAddress,
		ToAddress:    toAddress,
		Amount:       amount,
		TxHash:      log.TransactionHash,
		BlockNumber: blockNumberToUint64(log.BlockNumber),
		LogIndex:    log.LogIndex,
	}

	return h.db.StoreTransfer(ctx, transfer)
}

// Helper functions
func hexToBytes(s string) []byte {
	b, _ := hex.DecodeString(s)
	return b
}

func blockNumberToUint64(blockNumber string) uint64 {
	// Remove "0x" prefix if present
	blockNumber = strings.TrimPrefix(blockNumber, "0x")
	n := new(big.Int)
	n.SetString(blockNumber, 16)
	return n.Uint64()
}
