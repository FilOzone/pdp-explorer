package models

import (
	"math/big"
	"time"
)

type Transaction struct {
	ReorgModel
	Hash        string    `db:"hash"`
	ProofSetId  int64     `db:"proof_set_id"`
	MessageId   string    `db:"message_id"`
	Height      int64     `db:"height"`
	FromAddress string    `db:"from_address"`
	ToAddress   string    `db:"to_address"`
	Value       *big.Int     `db:"value"`
	Method      string    `db:"method"`
	Status      bool      `db:"status"`
	CreatedAt   time.Time `db:"created_at"`
}