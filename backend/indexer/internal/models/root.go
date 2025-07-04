package models

import (
	"time"
)

type Root struct {
	ReorgModel
	SetId                int64      `db:"set_id" json:"set_id"`
	RootId               int64      `db:"root_id" json:"root_id"`
	RawSize              int64      `db:"raw_size" json:"raw_size"`
	Cid                  string     `db:"cid" json:"cid"`
	Removed              bool       `db:"removed" json:"removed"`
	TotalProofsSubmitted int64      `db:"total_proofs_submitted" json:"total_proofs_submitted"`
	TotalPeriodsFaulted  int64      `db:"total_periods_faulted" json:"total_periods_faulted"`
	LastProvenEpoch      int64      `db:"last_proven_epoch" json:"last_proven_epoch"`
	LastProvenAt         *time.Time `db:"last_proven_at" json:"last_proven_at"`
	LastFaultedEpoch     int64      `db:"last_faulted_epoch" json:"last_faulted_epoch"`
	LastFaultedAt        *time.Time `db:"last_faulted_at" json:"last_faulted_at"`
	CreatedAt            time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt            time.Time  `db:"updated_at" json:"updated_at"`
}
