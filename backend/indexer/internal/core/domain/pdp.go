package domain

import (
	"time"
)

type PDPProof struct {
	ID          string    `json:"id"`
	ContractID  string    `json:"contract_id"`
	Prover      string    `json:"prover"`
	BlockNumber uint64    `json:"block_number"`
	Timestamp   time.Time `json:"timestamp"`
	ProofData   []byte    `json:"proof_data"`
	Status      string    `json:"status"`
}
