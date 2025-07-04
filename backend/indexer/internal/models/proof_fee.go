package models

import (
	"math/big"
	"time"
)

type ProofFee struct {
	ReorgModel
	FeeId               string    `db:"fee_id"`
	SetId               int64     `db:"set_id"`
	ProofFee            *big.Int  `db:"proof_fee"`
	FilUsdPrice         int64     `db:"fil_usd_price"`
	FilUsdPriceExponent int32     `db:"fil_usd_price_exponent"`
	CreatedAt           time.Time `db:"created_at"`
}
