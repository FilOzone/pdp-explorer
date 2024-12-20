package ports

import (
	"context"

	"pdp-explorer-indexer/internal/core/domain"
)

type PDPRepository interface {
	SaveProof(ctx context.Context, proof *domain.PDPProof) error
	GetProofByID(ctx context.Context, id string) (*domain.PDPProof, error)
	ListProofs(ctx context.Context, limit, offset int) ([]*domain.PDPProof, error)
}
