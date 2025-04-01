# Development Guide

## Table of Contents
- [Overview](#overview)
- [Development Environment Setup](#development-environment-setup)
- [Development Workflow](#development-workflow)
- [Code Structure](#code-structure)
- [Additional Resources](#additional-resources)

## Overview

This document provides guidelines and instructions for developers working on the PDP Explorer backend. It covers setup procedures, development workflows, and best practices to ensure consistent and high-quality contributions.

## Development Environment Setup

### Prerequisites

- Go 1.19 or higher
- PostgreSQL 14 or higher
- Docker and Docker Compose (optional, for containerized development)
- Make

### Initial Setup

1. **Clone the repository**:

   ```bash
   git clone https://github.com/FilOzone/pdp-explorer.git
   cd pdp-explorer
   ```

2. **Set up environment variables**:
   Create a `.env` file with following variables at:

   - `backend/indexer/.env`

     ```
     # Database
     DATABASE_URL=postgresql://localhost:5432/pdp

     # RPC provider
     LOTUS_API_ENDPOINT=https://api.calibration.node.glif.io/rpc/v0
     LOTUS_API_KEY= # Your API key (from https://api.node.glif.io)

     # Trigger config
     TRIGGERS_CONFIG=./config/pdp.yaml
     START_BLOCK= # Start block number
     ```

   - `backend/server/.env`

     ```
     # Database
     DATABASE_URL=postgresql://localhost:5432/pdp

     # Server Port
     PORT=3000
     ```

   - `client/.env`
     ```
     VITE_SERVER_URL=http://localhost:3000
     VITE_NETWORK=calibration
     ```

3. **Initialize the database**:

   ```bash
   cd backend/indexer
   make migrate-up
   ```

## Development Workflow

### Running the Indexer

```bash
# From root of the repository
cd backend/indexer

# Run the indexer in development mode
make dev
```

### Running the API Server

```bash
# From root of the repository
cd backend/server

# Run the API server in development mode
make dev
```

### Running the Frontend

```bash
# From root of the repository
cd client

# Run the frontend in development mode
npm run dev
```

## Code Structure

### Indexer Directory Layout

```
backend/indexer/
├── cmd/
│   └── indexer/          # Indexer application entrypoint
├── config/               # Configuration files
├── internal/
│   ├── client/           # RPC client library
│   ├── contract/         # Contract related code
│   ├── indexer/          # Blockchain indexing logic
│   ├── infrastructure/   # Infrastructure layer
│   │   ├── config/       # Infrastructure configuration
│   │   └── database/     # Database access layer
│   ├── logger/           # Logging package
│   ├── models/           # Data models
│   ├── processor/        # Transactions and events processor
│   │   └── handlers/     # Event and transaction handlers
│   └── types/            # Common types
├── migrations/           # Database migrations
└── scripts/              # Utility sql scripts
```

## Additional Resources

- [Go Documentation](https://golang.org/doc/)
- [Echo Framework Documentation](https://echo.labstack.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Filecoin Documentation](https://docs.filecoin.io/)
