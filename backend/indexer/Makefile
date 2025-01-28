.PHONY: build run test clean lint deps dev migrate

# Project variables
BINARY_NAME=pdp-indexer
GO_FILES=$(shell find . -name '*.go')

# Go commands
GOCMD=go
GOBUILD=$(GOCMD) build
GOTEST=$(GOCMD) test
GOMOD=$(GOCMD) mod
GOLINT=golangci-lint

# Build flags
LDFLAGS=-ldflags "-w -s"

# Add this after the Go commands section
AIR_VERSION=v1.40.0
GOPATH=$(shell go env GOPATH)
AIR=$(GOPATH)/bin/air

# Build and run
build:
	$(GOBUILD) $(LDFLAGS) -o bin/$(BINARY_NAME) .

run: build
	./bin/$(BINARY_NAME)

dev:
	@if ! command -v air > /dev/null; then \
		echo "Installing air..." && \
		go install github.com/cosmtrek/air@$(AIR_VERSION); \
	fi
	$(AIR) -c .air.toml

# Testing and quality
test:
	$(GOTEST) -v ./...

lint:
	$(GOLINT) run

# Dependencies
deps:
	$(GOMOD) download
	$(GOMOD) tidy


# Setup
setup: deps
	cp -n .env.example .env || true

# Database queries
db-blocks:
	PGPASSWORD=postgres psql -h localhost -U postgres -d postgres -c "SELECT * FROM blocks ORDER BY height DESC LIMIT 10;"

db-count:
	PGPASSWORD=postgres psql -h localhost -U postgres -d postgres -c "SELECT COUNT(*) as total_blocks FROM blocks;"

db-range:
	PGPASSWORD=postgres psql -h localhost -U postgres -d postgres -c "SELECT MIN(height) as first_block, MAX(height) as last_block FROM blocks;"

db-recent:
	PGPASSWORD=postgres psql -h localhost -U postgres -d postgres -c "SELECT * FROM blocks WHERE timestamp > NOW() - INTERVAL '1 hour' ORDER BY height DESC;"

# Migration commands
migrate-up:
	PGPASSWORD=postgres psql -h localhost -U postgres -d postgres -f migrations/000001_create_blocks_table.up.sql
	PGPASSWORD=postgres psql -h localhost -U postgres -d postgres -f migrations/000002_create_reorged_blocks_table.up.sql
	PGPASSWORD=postgres psql -h localhost -U postgres -d postgres -f migrations/000003_create_transfers.up.sql
	PGPASSWORD=postgres psql -h localhost -U postgres -d postgres -f migrations/000101_create_providers_table.up.sql
	PGPASSWORD=postgres psql -h localhost -U postgres -d postgres -f migrations/000102_create_proof_sets_table.up.sql
	PGPASSWORD=postgres psql -h localhost -U postgres -d postgres -f migrations/000103_create_transactions_table.up.sql
	PGPASSWORD=postgres psql -h localhost -U postgres -d postgres -f migrations/000104_create_event_logs_table.up.sql
	PGPASSWORD=postgres psql -h localhost -U postgres -d postgres -f migrations/000105_create_roots_table.up.sql


migrate-down:
	PGPASSWORD=postgres psql -h localhost -U postgres -d postgres -f migrations/000001_create_blocks_table.down.sql
	PGPASSWORD=postgres psql -h localhost -U postgres -d postgres -f migrations/000002_create_reorged_blocks_table.down.sql
	PGPASSWORD=postgres psql -h localhost -U postgres -d postgres -f migrations/000003_create_transfers.down.sql
	PGPASSWORD=postgres psql -h localhost -U postgres -d postgres -f migrations/000101_create_providers_table.down.sql
	PGPASSWORD=postgres psql -h localhost -U postgres -d postgres -f migrations/000102_create_proof_sets_table.down.sql
	PGPASSWORD=postgres psql -h localhost -U postgres -d postgres -f migrations/000103_create_transactions_table.down.sql
	PGPASSWORD=postgres psql -h localhost -U postgres -d postgres -f migrations/000104_create_event_logs_table.down.sql
	PGPASSWORD=postgres psql -h localhost -U postgres -d postgres -f migrations/000105_create_roots_table.down.sql

	