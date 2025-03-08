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
			ProviderID:          p.ProviderID,
			TotalFaultedPeriods: p.TotalFaultedPeriods,
			TotalDataSize:       p.TotalDataSize,
			ProofSetIDs:         p.ProofSetIDs,
			BlockNumber:         p.BlockNumber,
			BlockHash:           p.BlockHash,
			CreatedAt:           p.CreatedAt,
			UpdatedAt:           p.UpdatedAt,
			ActiveProofSets:     p.ActiveProofSets,
			NumRoots:            p.NumRoots,
			FirstSeen:           p.FirstSeen,
			LastSeen:            p.LastSeen,
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
			SetID:               ps.SetID,
			Owner:               ps.Owner,
			ListenerAddr:        ps.ListenerAddr,
			TotalFaultedPeriods: ps.TotalFaultedPeriods,
			TotalDataSize:       ps.TotalDataSize,
			TotalRoots:          ps.TotalRoots,
			TotalProvedRoots:    ps.TotalProvedRoots,
			TotalFeePaid:        ps.TotalFeePaid,
			LastProvenEpoch:     ps.LastProvenEpoch,
			NextChallengeEpoch:  ps.NextChallengeEpoch,
			IsActive:            ps.IsActive,
			BlockNumber:         ps.BlockNumber,
			BlockHash:           ps.BlockHash,
			CreatedAt:           ps.CreatedAt,
			UpdatedAt:           ps.UpdatedAt,
		}
	}

	return &handlers.ProviderDetails{
		ProviderID:          provider.ProviderID,
		TotalFaultedPeriods: provider.TotalFaultedPeriods,
		TotalDataSize:       provider.TotalDataSize,
		ProofSetIDs:         provider.ProofSetIDs,
		BlockNumber:         provider.BlockNumber,
		BlockHash:           provider.BlockHash,
		CreatedAt:           provider.CreatedAt,
		UpdatedAt:           provider.UpdatedAt,
		ActiveProofSets:     provider.ActiveProofSets,
		NumRoots:            provider.NumRoots,
		FirstSeen:           provider.FirstSeen,
		LastSeen:            provider.LastSeen,
		ProofSets:           mappedProofSets,
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
			SetID:               ps.SetID,
			Owner:               ps.Owner,
			ListenerAddr:        ps.ListenerAddr,
			TotalFaultedPeriods: ps.TotalFaultedPeriods,
			TotalDataSize:       ps.TotalDataSize,
			TotalRoots:          ps.TotalRoots,
			TotalProvedRoots:    ps.TotalProvedRoots,
			TotalFeePaid:        ps.TotalFeePaid,
			LastProvenEpoch:     ps.LastProvenEpoch,
			NextChallengeEpoch:  ps.NextChallengeEpoch,
			IsActive:            ps.IsActive,
			BlockNumber:         ps.BlockNumber,
			BlockHash:           ps.BlockHash,
			CreatedAt:           ps.CreatedAt,
			UpdatedAt:           ps.UpdatedAt,
		}
	}

	return result, total, nil
}

func (s *Service) GetProofSetDetails(proofSetID string) (*handlers.ProofSetDetails, error) {
	proofSet, err := s.repo.GetProofSetDetails(context.Background(), proofSetID)
	if err != nil {
		return nil, fmt.Errorf("failed to get proof set details: %w", err)
	}

	return &handlers.ProofSetDetails{
		SetID:               proofSet.SetID,
		Owner:               proofSet.Owner,
		ListenerAddr:        proofSet.ListenerAddr,
		TotalFaultedPeriods: proofSet.TotalFaultedPeriods,
		TotalDataSize:       proofSet.TotalDataSize,
		TotalRoots:          proofSet.TotalRoots,
		TotalProvedRoots:    proofSet.TotalProvedRoots,
		TotalFeePaid:        proofSet.TotalFeePaid,
		LastProvenEpoch:     proofSet.LastProvenEpoch,
		NextChallengeEpoch:  proofSet.NextChallengeEpoch,
		IsActive:            proofSet.IsActive,
		BlockNumber:         proofSet.BlockNumber,
		BlockHash:           proofSet.BlockHash,
		CreatedAt:           proofSet.CreatedAt,
		UpdatedAt:           proofSet.UpdatedAt,
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
	return s.repo.Search(ctx, query)
}

func (s *Service) GetProviderProofSets(providerID string, offset, limit int) ([]handlers.ProofSet, int, error) {
	proofSets, total, err := s.repo.GetProviderProofSets(context.Background(), providerID, offset, limit)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get provider proof sets: %w", err)
	}

	result := make([]handlers.ProofSet, len(proofSets))
	for i, ps := range proofSets {
		result[i] = handlers.ProofSet{
			SetID:               ps.SetID,
			Owner:               ps.Owner,
			ListenerAddr:        ps.ListenerAddr,
			TotalFaultedPeriods: ps.TotalFaultedPeriods,
			TotalDataSize:       ps.TotalDataSize,
			TotalRoots:          ps.TotalRoots,
			TotalProvedRoots:    ps.TotalProvedRoots,
			TotalFeePaid:        ps.TotalFeePaid,
			LastProvenEpoch:     ps.LastProvenEpoch,
			NextChallengeEpoch:  ps.NextChallengeEpoch,
			IsActive:            ps.IsActive,
			BlockNumber:         ps.BlockNumber,
			BlockHash:           ps.BlockHash,
			CreatedAt:           ps.CreatedAt,
			UpdatedAt:           ps.UpdatedAt,
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

func (s *Service) GetProofSetEventLogs(proofSetID string, filter string, offset, limit int) ([]handlers.EventLog, int, error) {
	eventLogs, total, err := s.repo.GetProofSetEventLogs(context.Background(), proofSetID, filter, offset, limit)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get proof set event logs: %w", err)
	}

	result := make([]handlers.EventLog, len(eventLogs))
	for i, log := range eventLogs {
		result[i] = handlers.EventLog{
			SetID:           log.SetID,
			Address:         log.Address,
			Name:            log.Name,
			Data:            log.Data,
			LogIndex:        log.LogIndex,
			Removed:         log.Removed,
			Topics:          log.Topics,
			BlockNumber:     log.BlockNumber,
			BlockHash:       log.BlockHash,
			TransactionHash: log.TransactionHash,
			CreatedAt:       log.CreatedAt,
		}
	}

	return result, total, nil
}

func (s *Service) GetProofSetTxs(proofSetID string, filter string, offset, limit int) ([]handlers.Transaction, int, error) {
	txs, total, err := s.repo.GetProofSetTxs(context.Background(), proofSetID, filter, offset, limit)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get proof set txs: %w", err)
	}

	result := make([]handlers.Transaction, len(txs))
	for i, tx := range txs {
		result[i] = handlers.Transaction{
			Hash:        tx.Hash,      
			ProofSetID:  tx.ProofSetID,
			MessageID:   tx.MessageID,
			Height:      tx.Height,
			FromAddress: tx.FromAddress,
			ToAddress:   tx.ToAddress,
			Value:       tx.Value,
			Method:      tx.Method,
			Status:      tx.Status,
			BlockNumber: tx.BlockNumber,
			BlockHash:   tx.BlockHash,
			CreatedAt:   tx.CreatedAt,
		}
	}

	return result, total, nil
}

func (s *Service) GetProofSetRoots(proofSetID string, offset, limit int) ([]handlers.Root, int, error) {
	roots, total, err := s.repo.GetProofSetRoots(context.Background(), proofSetID, offset, limit)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get proof set roots: %w", err)
	}

	result := make([]handlers.Root, len(roots))
	for i, root := range roots {
		result[i] = handlers.Root{
			RootID: root.RootId,
			Cid:    root.Cid,
			Size:   root.RawSize,
			Removed: root.Removed,
			TotalPeriodsFaulted: root.TotalPeriodsFaulted,
			TotalProofsSubmitted: root.TotalProofsSubmitted,
			LastProvenEpoch: root.LastProvenEpoch,
			LastProvenAt: root.LastProvenAt,
			LastFaultedEpoch: root.LastFaultedEpoch,
			LastFaultedAt: root.LastFaultedAt,
			CreatedAt: root.CreatedAt,
		}
	}

	return result, total, nil
}
