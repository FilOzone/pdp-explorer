package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"go-server/internal/config"
	"go-server/internal/handlers"
	"go-server/internal/repository"
	"go-server/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v4/pgxpool"
)

func main() {
	log.Println("Starting server...")

	// Load configuration
	cfg := config.Load()

	// Create a context for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize database connection
	dbPool, err := pgxpool.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v\n", err)
	}

	// Initialize repository, service, and handler layers
	repo := repository.NewRepository(dbPool)
	svc := service.NewService(repo)
	handler := handlers.NewHandler(svc)

	// Create a WaitGroup for tracking in-flight requests
	var wg sync.WaitGroup

	router := gin.Default()

	// Add middleware
	router.Use(gin.Recovery())
	router.Use(gin.Logger())

	// Add middleware to track in-flight requests
	router.Use(func(c *gin.Context) {
		wg.Add(1)
		defer wg.Done()
		c.Next()
	})

	// Setup routes
	handler.SetupRoutes(router)

	// Create server
	srv := &http.Server{
		Addr:    fmt.Sprintf(":%s", cfg.Port),
		Handler: router,
	}

	// Start server
	go func() {
		log.Printf("Server is listening on port %s\n", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v\n", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("\nShutdown signal received...")

	// Cancel the context to notify all operations
	cancel()

	// Give outstanding requests 5 seconds to complete
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutdownCancel()

	log.Println("Shutting down server...")
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	// Wait for in-flight requests to complete with timeout
	waitChan := make(chan struct{})
	go func() {
		wg.Wait()
		close(waitChan)
	}()

	select {
	case <-waitChan:
		log.Println("All requests completed")
	case <-shutdownCtx.Done():
		log.Println("Timeout waiting for requests to complete")
	}

	// Close database connection
	log.Println("Closing database connection...")
	dbPool.Close()

	log.Println("Server exiting")
}
