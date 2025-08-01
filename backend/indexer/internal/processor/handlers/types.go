package handlers

import (
	"context"
	"math/big"

	"pdp-explorer-indexer/internal/models"
)

// Database interface for handlers
type Database interface {
	// Provider methods
	StoreProvider(ctx context.Context, provider *models.Provider) error
	FindProvider(ctx context.Context, address string, includeHistory bool) ([]*models.Provider, error)

	// DataSet methods
	StoreProofSet(ctx context.Context, proofSet *models.DataSet) error
	FindProofSet(ctx context.Context, setId int64, includeHistory bool) ([]*models.DataSet, error)

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

