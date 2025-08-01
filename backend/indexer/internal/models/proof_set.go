package models

import (
	"math/big"
	"time"
)

type DataSet struct {
	ReorgModel                    // Embed ReorgModel to inherit base fields and methods
	SetId               int64     `db:"set_id" json:"set_id"`
	Owner               string    `db:"owner" json:"owner"`
	ListenerAddr        string    `db:"listener_addr" json:"listener_addr"`
	TotalFaultedPeriods int64    `db:"total_faulted_periods" json:"total_faulted_periods"`
	TotalDataSize       *big.Int    `db:"total_data_size" json:"total_data_size"`
	TotalRoots          int64    `db:"total_roots" json:"total_roots"`
	TotalProvedRoots    int64    `db:"total_proved_roots" json:"total_proved_roots"`
	TotalFeePaid        *big.Int    `db:"total_fee_paid" json:"total_fee_paid"`
	LastProvenEpoch     int64    `db:"last_proven_epoch" json:"last_proven_epoch"`
	NextChallengeEpoch  int64    `db:"next_challenge_epoch" json:"next_challenge_epoch"`
	ChallengeRange      int64    `db:"challenge_range" json:"challenge_range"`
	IsActive            bool      `db:"is_active" json:"is_active"`
	CreatedAt           time.Time `db:"created_at" json:"created_at"`
	UpdatedAt           time.Time `db:"updated_at" json:"updated_at"`
}