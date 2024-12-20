package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL string
	Blockchain  struct {
		RPC      string
		ChainID  int64
		Contract string
	}
	Server struct {
		Port int
	}
}

func LoadConfig() (*Config, error) {
	if err := godotenv.Load(); err != nil {
		return nil, fmt.Errorf("error loading .env file: %v", err)
	}

	config := &Config{}

	// Database configuration
	config.DatabaseURL = os.Getenv("DATABASE_URL")
	if config.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	// Blockchain configuration
	config.Blockchain.RPC = os.Getenv("BLOCKCHAIN_RPC")
	if config.Blockchain.RPC == "" {
		return nil, fmt.Errorf("BLOCKCHAIN_RPC is required")
	}

	chainID, err := strconv.ParseInt(os.Getenv("BLOCKCHAIN_CHAIN_ID"), 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid BLOCKCHAIN_CHAIN_ID: %v", err)
	}
	config.Blockchain.ChainID = chainID

	config.Blockchain.Contract = os.Getenv("BLOCKCHAIN_CONTRACT")
	if config.Blockchain.Contract == "" {
		return nil, fmt.Errorf("BLOCKCHAIN_CONTRACT is required")
	}

	// Server configuration
	serverPort, err := strconv.Atoi(os.Getenv("SERVER_PORT"))
	if err != nil {
		return nil, fmt.Errorf("invalid SERVER_PORT: %v", err)
	}
	config.Server.Port = serverPort

	return config, nil
}
