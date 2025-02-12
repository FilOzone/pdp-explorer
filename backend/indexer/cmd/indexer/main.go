package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"pdp-explorer-indexer/internal/config"
	"pdp-explorer-indexer/internal/indexer"
	"pdp-explorer-indexer/internal/infrastructure/database"
)

func main() {
	log.Println("Starting PDP Explorer Multi-Chain Indexer...")

	// Load configurations
	chainConfigs, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load configurations: %v", err)
	}

	log.Printf("Found %d chain configurations", len(chainConfigs))

	// Setup graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Create and start indexers for each chain
	var wg sync.WaitGroup
	indexers := make([]*indexer.Indexer, 0, len(chainConfigs))

	for _, cfg := range chainConfigs {
		chainConfig := cfg // Create a new variable to avoid closure problems

		// Initialize database connection
		db, err := database.NewPostgresDB(chainConfig.DatabaseURL)
		if err != nil {
			log.Fatalf("Failed to connect to database: %v", err)
		}
		defer db.Close()
		
		idx, err := indexer.NewIndexer(db, &chainConfig)
		if err != nil {
			log.Printf("ERROR: Failed to initialize indexer for chain %s: %v", chainConfig.Name, err)
			continue
		}
		indexers = append(indexers, idx)

		wg.Add(1)
		go func() {
			defer wg.Done()
			log.Printf("Starting indexer for chain: %s (Chain ID: %d)", chainConfig.Name, chainConfig.ChainID)
			
			if err := idx.Start(ctx); err != nil {
				log.Printf("ERROR: Indexer for chain %s stopped with error: %v", chainConfig.Name, err)
				return
			}
		}()
	}

	// Add metrics logging
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				for i := range len(indexers) {
					log.Printf("Indexer (%x) is running... (Timestamp: %v)", i, time.Now().Format(time.RFC3339))
				}
			}
		}
	}()

	// Wait for shutdown signal
	sig := <-sigChan
	log.Printf("Shutdown signal received: %v", sig)
	cancel()

	// Wait for all indexers to shut down gracefully
	log.Println("Waiting for all indexers to shut down...")
	wg.Wait()
	log.Println("All indexers shut down successfully")
}
