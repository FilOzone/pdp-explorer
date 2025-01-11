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

	// Create a context that can be cancelled
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Load configuration
	log.Println("Loading configuration...")
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}
	log.Println("Configuration loaded successfully")

	// Initialize database connection
	log.Println("Connecting to database...")
	db, err := database.NewPostgresDB(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()
	log.Println("Database connection established")

	// Initialize indexer
	log.Println("Initializing indexer...")
	idx := indexer.NewIndexer(db, cfg)
	log.Println("Indexer initialized")

	// Setup graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	log.Println("Graceful shutdown handlers configured")

	// Start the indexer in a goroutine
	log.Println("Starting indexer process...")
	go func() {
		log.Println("Indexer goroutine started")
		if err := idx.Start(ctx); err != nil {
			log.Printf("ERROR: Indexer stopped with error: %v", err)
			cancel()
			return
		}
		log.Println("Indexer goroutine completed successfully")
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

	log.Println("Indexer started successfully - waiting for shutdown signal")

	// Wait for shutdown signal
	sig := <-sigChan
	log.Printf("Shutdown signal received: %v", sig)

	// Cancel context to stop the indexer
	cancel()
	log.Println("Context cancelled, waiting for cleanup...")
	log.Println("Indexer stopped gracefully")
}
