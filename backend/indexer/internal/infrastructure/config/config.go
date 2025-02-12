package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL string
	Server      struct {
		Port int
	}
	EventsFilePath   string
	LotusAPIEndpoint string
	LotusAPIKey      string
	LotusSocketUrl   string
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
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	// Server configuration
	serverPort, err := strconv.Atoi(os.Getenv("SERVER_PORT"))
	if err != nil {
		return nil, fmt.Errorf("invalid SERVER_PORT: %v", err)
	}
	config.Server.Port = serverPort

	config.EventsFilePath = os.Getenv("EVENTS_FILE_PATH")
	fmt.Println("EventsFilePath:", config.EventsFilePath)
	if config.EventsFilePath == "" {
		return nil, fmt.Errorf("EVENTS_FILE_PATH is required")
	}

	config.LotusAPIEndpoint = os.Getenv("LOTUS_API_ENDPOINT")
	fmt.Println("LotusAPIEndpoint:", config.LotusAPIEndpoint)
	if config.LotusAPIEndpoint == "" {
		return nil, fmt.Errorf("LOTUS_API_ENDPOINT is required")
	}

	config.LotusAPIKey = os.Getenv("LOTUS_API_KEY")
	fmt.Println("LotusAPIKey:", config.LotusAPIKey)

	config.LotusSocketUrl = os.Getenv("LOTUS_SOCKET_URL")
	fmt.Println("LotusSocketUrl:", config.LotusSocketUrl)
	if config.LotusSocketUrl == "" {
		return nil, fmt.Errorf("LOTUS_SOCKET_URL is required")
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
