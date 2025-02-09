package models

import (
	"time"
)

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