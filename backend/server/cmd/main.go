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

	cfg := config.Load()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	dbPool, err := pgxpool.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v\n", err)
	}

	repo := repository.NewRepository(dbPool)
	svc := service.NewService(repo)
	handler := handlers.NewHandler(svc)

	var wg sync.WaitGroup

	router := gin.Default()

	router.Use(gin.Recovery())
	router.Use(gin.Logger())

	router.Use(func(c *gin.Context) {
		wg.Add(1)
		defer wg.Done()
		c.Next()
	})

	handler.SetupRoutes(router)

	srv := &http.Server{
		Addr:    fmt.Sprintf(":%s", cfg.Port),
		Handler: router,
	}

	go func() {
		log.Printf("Server is listening on port %s\n", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v\n", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("\nShutdown signal received...")

	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutdownCancel()

	log.Println("Shutting down server...")
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

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
