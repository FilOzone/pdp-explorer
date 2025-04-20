package config

import (
	"fmt"
	"os"
	"pdp-explorer-indexer/internal/logger"
	"strconv"

	"github.com/joho/godotenv"
)

// Default configuration values
const (
	DefaultDatabaseURL        = "postgresql://postgres:postgres@localhost:5432/pdp?sslmode=disable"
	DefaultTriggersConfigPath = "./config/pdp.yaml"
	DefaultLotusAPIEndpoint   = "https://api.node.glif.io/rpc/v1"
)

type Config struct {
	DatabaseURL      string
	TriggersConfig   string
	LotusAPIEndpoint string
	LotusAPIKey      string
	StartBlock       uint64
}

func LoadConfig() (*Config, error) {
	err := godotenv.Load()
	if err != nil {
		logger.Infof("Error loading .env file %s", err)
	}

	config := &Config{}

	// Database configuration
	config.DatabaseURL = os.Getenv("DATABASE_URL")
	if config.DatabaseURL == "" {
		config.DatabaseURL = DefaultDatabaseURL
		logger.Infof("Using default DATABASE_URL: %s", config.DatabaseURL)
	}

	config.TriggersConfig = os.Getenv("TRIGGERS_CONFIG")
	if config.TriggersConfig == "" {
		config.TriggersConfig = DefaultTriggersConfigPath
		logger.Infof("Using default TriggersConfig: %s", config.TriggersConfig)
	} else {
		logger.Infof("TriggersConfig(config): %s", config.TriggersConfig)
	}

	config.LotusAPIEndpoint = os.Getenv("LOTUS_API_ENDPOINT")
	if config.LotusAPIEndpoint == "" {
		config.LotusAPIEndpoint = DefaultLotusAPIEndpoint
		logger.Infof("Using default LotusAPIEndpoint: %s", config.LotusAPIEndpoint)
	} else {
		logger.Infof("LotusAPIEndpoint(config): %s", config.LotusAPIEndpoint)
	}

	config.LotusAPIKey = os.Getenv("LOTUS_API_KEY")
	if config.LotusAPIKey == "" {
		logger.Info("No LOTUS_API_KEY specified, this will result in rate limits on rpc calls")
	}

	// Parse StartBlock configuration
	startBlockStr := os.Getenv("START_BLOCK")
	if startBlockStr != "" {
		startBlock, err := strconv.ParseUint(startBlockStr, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid START_BLOCK: %w", err)
		}
		config.StartBlock = startBlock
		logger.Infof("Indexer start block(config): %d", config.StartBlock)
	} else {
		logger.Info("No START_BLOCK specified, will start from last synced block")
	}

	return config, nil
}
