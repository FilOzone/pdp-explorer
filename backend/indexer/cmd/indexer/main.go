package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"pdp-explorer-indexer/internal/indexer"
	"pdp-explorer-indexer/internal/infrastructure/config"
	"pdp-explorer-indexer/internal/infrastructure/database"
)

func main() {
	log.Println("Starting PDP Explorer Indexer...")

	// Load configuration
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Initialize database connection
	db, err := database.NewPostgresDB(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Initialize indexer
	idx, err := indexer.NewIndexer(db, cfg)
	if err != nil {
		log.Fatalf("Failed to initialize indexer: %v", err)
	}

	// Setup graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Create a context that can be cancelled
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start the indexer in a goroutine
	go func() {
		if err := idx.Start(ctx); err != nil {
			log.Printf("ERROR: Indexer stopped with error: %v", err)
			cancel()
			return
		}
	}()

	// Add metrics logging
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				log.Printf("Indexer is running... (Timestamp: %v)", time.Now().Format(time.RFC3339))
			}
		}
	}()

	// Wait for shutdown signal
	sig := <-sigChan
	log.Printf("Shutdown signal received: %v", sig)
	cancel()
}
