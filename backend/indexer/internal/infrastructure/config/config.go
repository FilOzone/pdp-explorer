package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

// Default configuration values
const (
	DefaultDatabaseURL      = "postgresql://postgres:postgres@localhost:5432/pdp?sslmode=disable"
	DefaultTriggersConfigPath   = "./config/pdp.yaml"
	DefaultLotusAPIEndpoint = "https://api.node.glif.io/rpc/v1"
)

type Config struct {
	DatabaseURL string
	TriggersConfig   string
	LotusAPIEndpoint string
	LotusAPIKey      string
	StartBlock       uint64
}

func LoadConfig() (*Config, error) {
	if err := godotenv.Load(); err != nil {
		return nil, fmt.Errorf("error loading .env file: %v", err)
	}

	config := &Config{}

	// Database configuration
	config.DatabaseURL = os.Getenv("DATABASE_URL")
	if config.DatabaseURL == "" {
		config.DatabaseURL = DefaultDatabaseURL
		fmt.Println("Using default DATABASE_URL:", config.DatabaseURL)
	}

	config.TriggersConfig = os.Getenv("TRIGGERS_CONFIG")
	if config.TriggersConfig == "" {
		config.TriggersConfig = DefaultTriggersConfigPath
		fmt.Println("Using default TriggersConfig:", config.TriggersConfig)
	} else {
		fmt.Println("TriggersConfig:", config.TriggersConfig)
	}

	config.LotusAPIEndpoint = os.Getenv("LOTUS_API_ENDPOINT")
	if config.LotusAPIEndpoint == "" {
		config.LotusAPIEndpoint = DefaultLotusAPIEndpoint
		fmt.Println("Using default LotusAPIEndpoint:", config.LotusAPIEndpoint)
	} else {
		fmt.Println("LotusAPIEndpoint:", config.LotusAPIEndpoint)
	}

	config.LotusAPIKey = os.Getenv("LOTUS_API_KEY")
	if config.LotusAPIKey == "" {
		fmt.Println("No LOTUS_API_KEY specified, this will result in rate limits on rpc calls")
	}

	// Parse StartBlock configuration
	startBlockStr := os.Getenv("START_BLOCK")
	if startBlockStr != "" {
		startBlock, err := strconv.ParseUint(startBlockStr, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid START_BLOCK: %w", err)
		}
		config.StartBlock = startBlock
		fmt.Printf("Starting from block: %d\n", config.StartBlock)
	} else {
		fmt.Println("No START_BLOCK specified, will start from last synced block")
	}

	return config, nil
}
