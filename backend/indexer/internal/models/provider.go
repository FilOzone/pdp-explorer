package models

import (
	"math/big"
	"time"
)

type Provider struct {
	ReorgModel
	Address             string    `db:"address" json:"address"`
	TotalFaultedPeriods int64    `db:"total_faulted_periods" json:"total_faulted_periods"`
	TotalDataSize       *big.Int    `db:"total_data_size" json:"total_data_size"`
	ProofSetIds         []int64   `db:"proof_set_ids" json:"proof_set_ids"`
	CreatedAt           time.Time `db:"created_at" json:"created_at"`
	UpdatedAt           time.Time `db:"updated_at" json:"updated_at"`
}