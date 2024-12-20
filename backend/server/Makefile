.PHONY: build run test clean lint deps dev

# Project variables
BINARY_NAME=pdp-api
GO_FILES=$(shell find . -name '*.go')

# Go commands
GOCMD=go
GOBUILD=$(GOCMD) build
GOTEST=$(GOCMD) test
GOMOD=$(GOCMD) mod
GOLINT=golangci-lint

# Build flags
LDFLAGS=-ldflags "-w -s"

# Build and run
build:
	$(GOBUILD) $(LDFLAGS) -o bin/$(BINARY_NAME) .

run: build
	./bin/$(BINARY_NAME)

dev:
	air -c .air.toml

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