package handlers

import (
	"context"
	"math/big"
	"time"

	"pdp-explorer-indexer/internal/models"

	"github.com/jmoiron/sqlx/types"
)

// Database interface for handlers
type Database interface {
	// Provider methods
	StoreProvider(ctx context.Context, provider *models.Provider) error
	FindProvider(ctx context.Context, address string, includeHistory bool) ([]*models.Provider, error)

	// ProofSet methods
	StoreProofSet(ctx context.Context, proofSet *models.ProofSet) error
	FindProofSet(ctx context.Context, setId int64, includeHistory bool) ([]*models.ProofSet, error)

	// ProofFee methods
	StoreProofFee(ctx context.Context, proofFee *models.ProofFee) error

	// Root methods
	StoreRoot(ctx context.Context, root *models.Root) error
	FindRoot(ctx context.Context, setId, rootId int64) (*models.Root, error)

	// Proof methods
	StoreProof(ctx context.Context, proof *models.Proof) error

	// Fault methods
	StoreFaultRecords(ctx context.Context, record *models.FaultRecord) error

	// Event methods
	StoreEventLog(ctx context.Context, event *models.EventLog) error

	// Transaction methods
	StoreTransaction(ctx context.Context, transaction *models.Transaction) error
}

// ReorgModel provides base fields and methods for reorg handling
type ReorgModel struct {
	ID          int64  `db:"id" json:"id"`
	BlockNumber uint64 `db:"block_number" json:"block_number"`
	BlockHash   string `db:"block_hash" json:"block_hash"`
	PreviousID  *int64 `db:"previous_id" json:"previous_id,omitempty"`
}

// Transfer represents a WFIL transfer
type Transfer struct {
	ReorgModel            // Embed ReorgModel to inherit base fields and methods
	FromAddress string    `db:"from_address" json:"from_address"`
	ToAddress   string    `db:"to_address" json:"to_address"`
	Amount      *big.Int  `db:"amount" json:"amount"`
	TxHash      string    `db:"tx_hash" json:"tx_hash"`
	LogIndex    string    `db:"log_index" json:"log_index"`
	CreatedAt   time.Time `db:"created_at_time" json:"created_at"`
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
	ProofOffset      int64    `db:"proof_offset"`
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

type Cid struct {
    Data []byte
}


type RootData struct {
	Root    Cid 
	RawSize *big.Int
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

