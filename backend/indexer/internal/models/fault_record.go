package models

import (
	"time"
)

type FaultRecord struct {
	ReorgModel
	SetId                 int64     `db:"set_id"`
	RootIds               []int64   `db:"root_ids" json:"root_ids"`
	CurrentChallengeEpoch int64     `db:"current_challenge_epoch"`
	NextChallengeEpoch    int64     `db:"next_challenge_epoch"`
	PeriodsFaulted        int64     `db:"periods_faulted"`
	Deadline              int64     `db:"deadline"`
	CreatedAt             time.Time `db:"created_at"`
}
