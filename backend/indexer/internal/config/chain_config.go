package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

// ChainConfig holds configuration for a specific blockchain
type ChainConfig struct {
	ChainID            uint64
	Name               string
	RPCEndpoint        string
	DatabaseURL       string
	APIKey             string
	StartBlock         uint64
	FinalizationDepth  uint64
	PollingInterval    uint64 // in seconds
	MaxBlocksBatchSize uint64
	EventsFilePath string
}

// LoadConfig loads both common and chain-specific configurations
func LoadConfig() ([]ChainConfig, error) {
	if err := godotenv.Load(); err != nil {
		return nil, fmt.Errorf("error loading .env file: %v", err)
	}

	// Load chain configurations
	configs, err := loadChainConfigs()
	if err != nil {
		return nil, fmt.Errorf("failed to load chain configs: %w", err)
	}

	return configs, nil
}

// loadChainConfigs loads configurations for all supported chains
func loadChainConfigs() ([]ChainConfig, error) {
	var configs []ChainConfig

	// Define supported chains
	chains := []struct {
		id   uint64
		name string
	}{
		{1, "MAINNET"},
		{314159, "CALIBRATION"},
	}

	for _, chain := range chains {
		prefix := chain.name
		config, err := loadChainConfig(prefix, chain.id)
		if err != nil {
			return nil, fmt.Errorf("failed to load config for %s: %w", chain.name, err)
		}
		if config != nil {
			configs = append(configs, *config)
		}
	}

	if len(configs) == 0 {
		return nil, fmt.Errorf("no chain configurations found")
	}

	return configs, nil
}

func loadChainConfig(prefix string, chainID uint64) (*ChainConfig, error) {
	rpcEndpoint := os.Getenv(prefix + "_RPC_ENDPOINT")
	if rpcEndpoint == "" {
		return nil, nil // Skip if RPC endpoint not configured
	}

	databaseURL := os.Getenv(prefix + "_DATABASE_URL")
	if databaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL environment variable is required")
	}

	startBlock, err := getEnvUint64(prefix + "_START_BLOCK", 0)
	if err != nil {
		return nil, fmt.Errorf("invalid start block: %w", err)
	}

	finalizationDepth, err := getEnvUint64(prefix + "_FINALIZATION_DEPTH", 900)
	if err != nil {
		return nil, fmt.Errorf("invalid finalization depth: %w", err)
	}

	pollingInterval, err := getEnvUint64(prefix + "_POLLING_INTERVAL", 15)
	if err != nil {
		return nil, fmt.Errorf("invalid polling interval: %w", err)
	}

	maxBlocksBatchSize, err := getEnvUint64(prefix + "_MAX_BLOCKS_BATCH_SIZE", 10)
	if err != nil {
		return nil, fmt.Errorf("invalid max blocks batch size: %w", err)
	}

	eventsFilePath := os.Getenv(prefix + "_EVENTS_FILE_PATH")
	if eventsFilePath == "" {
		return nil, fmt.Errorf("EVENTS_FILE_PATH environment variable is required")
	}

	return &ChainConfig{
		ChainID:            chainID,
		Name:               prefix,
		RPCEndpoint:        rpcEndpoint,
		DatabaseURL:        databaseURL,
		APIKey:             os.Getenv(prefix + "_API_KEY"),
		StartBlock:         startBlock,
		FinalizationDepth:  finalizationDepth,
		PollingInterval:    pollingInterval,
		MaxBlocksBatchSize: maxBlocksBatchSize,
		EventsFilePath:     eventsFilePath,
	}, nil
}

func getEnvUint64(key string, defaultValue uint64) (uint64, error) {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue, nil
	}

	parsed, err := strconv.ParseUint(value, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("failed to parse %s: %w", key, err)
	}

	return parsed, nil
}
