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

# Database
migrate-up:
	migrate -database ${DATABASE_URL} -path migrations up

migrate-down:
	migrate -database ${DATABASE_URL} -path migrations down

# Setup
setup: deps
	cp -n .env.example .env || true