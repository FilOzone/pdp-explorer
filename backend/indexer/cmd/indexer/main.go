package main

import (
	"log"

	"pdp-explorer-indexer/internal/infrastructure/config"
	"pdp-explorer-indexer/internal/infrastructure/database"
)

func main() {
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	db, err := database.NewPostgresDB(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	log.Println("Indexer started successfully")
	// TODO: Add indexing logic
}
