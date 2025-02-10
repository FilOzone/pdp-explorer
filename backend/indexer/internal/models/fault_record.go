package models

import (
	"time"
)

type FaultRecord struct {
	ReorgModel
	SetId          int64  `db:"set_id"`
	ChallengeEpoch int64    `db:"challenge_epoch"`
	PeriodsFaulted int64    `db:"periods_faulted"`
	Deadline       int64    `db:"deadline"`
	CreatedAt      time.Time `db:"created_at"`
}