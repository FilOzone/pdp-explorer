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
	LotusAPIEndpoint string
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

	config.LotusAPIEndpoint = os.Getenv("LOTUS_API_ENDPOINT")
	fmt.Println("LotusAPIEndpoint:", config.LotusAPIEndpoint)
	if config.LotusAPIEndpoint == "" {
		return nil, fmt.Errorf("LOTUS_API_ENDPOINT is required")
	}

	return config, nil
}
