package service

import (
	"context"
	"fmt"
	"go-server/internal/handlers"
	"go-server/internal/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{
		repo: repo,
	}
}

func (s *Service) GetProviders(offset, limit int) ([]handlers.Provider, int, error) {
	providers, total, err := s.repo.GetProviders(context.Background(), offset, limit)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get providers: %w", err)
	}

	result := make([]handlers.Provider, len(providers))
	for i, p := range providers {
		result[i] = handlers.Provider{
			ProviderID:      p.ProviderID,
			ActiveProofSets: p.ActiveProofSets,
			DataSizeStored:  p.DataSizeStored,
			NumRoots:        p.NumRoots,
			FirstSeen:       p.FirstSeen,
			LastSeen:        p.LastSeen,
		}
	}

	return result, total, nil
}

func (s *Service) GetProviderDetails(providerID string) (*handlers.ProviderDetails, error) {
	provider, proofSets, err := s.repo.GetProviderDetails(context.Background(), providerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get provider details: %w", err)
	}

	mappedProofSets := make([]handlers.ProofSet, len(proofSets))
	for i, ps := range proofSets {
		mappedProofSets[i] = handlers.ProofSet{
			ProofSetID: ps.SetID,
			Status:     ps.Status,
			FirstRoot:  ps.FirstRoot,
			NumRoots:   ps.NumRoots,
			CreatedAt:  ps.CreatedAt,
		}
	}

	return &handlers.ProviderDetails{
		ProviderID:      provider.ProviderID,
		ActiveProofSets: provider.ActiveProofSets,
		DataSizeStored:  provider.DataSizeStored,
		FirstSeen:       provider.FirstSeen,
		LastSeen:        provider.LastSeen,
		ProofSets:       mappedProofSets,
	}, nil
}

func (s *Service) GetProofSets(sortBy, order string, offset, limit int) ([]handlers.ProofSet, int, error) {
	proofSets, total, err := s.repo.GetProofSets(context.Background(), sortBy, order, offset, limit)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get proof sets: %w", err)
	}

	result := make([]handlers.ProofSet, len(proofSets))
	for i, ps := range proofSets {
		result[i] = handlers.ProofSet{
			ProofSetID:        ps.SetID,
			Status:            ps.Status,
			FirstRoot:         ps.FirstRoot,
			NumRoots:          ps.NumRoots,
			CreatedAt:         ps.CreatedAt,
			LastProofReceived: ps.UpdatedAt,
		}
	}

	return result, total, nil
}

func (s *Service) GetProofSetDetails(proofSetID string, txFilter string) (*handlers.ProofSetDetails, error) {
	proofSet, transactions, err := s.repo.GetProofSetDetails(context.Background(), proofSetID, txFilter)
	if err != nil {
		return nil, fmt.Errorf("failed to get proof set details: %w", err)
	}

	mappedTxs := make([]handlers.Transaction, len(transactions))
	for i, tx := range transactions {
		mappedTxs[i] = handlers.Transaction{
			TxID:   tx.TxID,
			Time:   tx.Time,
			Method: tx.Method,
		}
	}

	return &handlers.ProofSetDetails{
		ProofSetID:   proofSet.SetID,
		Status:       proofSet.Status,
		FirstRoot:    proofSet.FirstRoot,
		NumRoots:     proofSet.NumRoots,
		CreatedAt:    proofSet.CreatedAt,
		UpdatedAt:    proofSet.UpdatedAt,
		Transactions: mappedTxs,
	}, nil
}

func (s *Service) GetProofSetHeatmap(proofSetID string) ([]handlers.HeatmapEntry, error) {
	heatmapData, err := s.repo.GetProofSetHeatmap(context.Background(), proofSetID)
	if err != nil {
		return nil, fmt.Errorf("failed to get proof set heatmap: %w", err)
	}

	result := make([]handlers.HeatmapEntry, len(heatmapData))
	for i, entry := range heatmapData {
		result[i] = handlers.HeatmapEntry{
			Date:        entry.Date.Format("2006-01-02"),
			Status:      entry.Status,
			RootPieceID: entry.SetID,
		}
	}

	return result, nil
}

func (s *Service) GetNetworkMetrics(ctx context.Context) (map[string]interface{}, error) {
	return s.repo.GetNetworkMetrics(ctx)
}

func (s *Service) Search(ctx context.Context, query string, limit int) ([]map[string]interface{}, error) {
	return s.repo.Search(ctx, query, limit)
}

func (s *Service) GetProviderProofSets(providerID string, offset, limit int) ([]handlers.ProofSet, int, error) {
	proofSets, total, err := s.repo.GetProviderProofSets(context.Background(), providerID, offset, limit)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get provider proof sets: %w", err)
	}

	result := make([]handlers.ProofSet, len(proofSets))
	for i, ps := range proofSets {
		result[i] = handlers.ProofSet{
			ProofSetID:        ps.SetID,
			Status:            ps.Status,
			FirstRoot:         ps.FirstRoot,
			NumRoots:          ps.NumRoots,
			CreatedAt:         ps.CreatedAt,
			LastProofReceived: ps.UpdatedAt,
		}
	}

	return result, total, nil
}

func (s *Service) GetProviderActivities(providerID string, activityType string) ([]handlers.Activity, error) {
	activities, err := s.repo.GetProviderActivities(context.Background(), providerID, activityType)
	if err != nil {
		return nil, fmt.Errorf("failed to get provider activities: %w", err)
	}

	result := make([]handlers.Activity, len(activities))
	for i, activity := range activities {
		result[i] = handlers.Activity{
			ID:        activity.ID,
			Type:      activity.Type,
			Timestamp: activity.Timestamp,
			Details:   activity.Details,
		}
	}

	return result, nil
}
