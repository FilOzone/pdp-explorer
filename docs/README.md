# PDP Explorer Documentation

## Overview

This directory contains comprehensive documentation for the PDP Explorer backend system. The documentation is organized by component and covers the architecture, database schema, integration points, and development guidelines.

## Document Structure

### Indexer Documentation

The indexer is responsible for processing blockchain events and maintaining the database state.

- [**Architecture**](indexer/ARCHITECTURE.md): Overall system architecture and component design
- [**Database Schema**](indexer/DATABASE.md): Database schema design, tables, relationships, and optimizations
- [**Processor**](indexer/PROCESSOR.md): Details of the processor component that routes blockchain data to handlers
- [**Reorg Handling**](indexer/REORG_HANDLING.md): Chain reorganization detection and handling
- [**Integration**](indexer/INTEGRATION.md): Integration points with blockchain, database, and frontend
- [**Development Guide**](indexer/DEVELOPMENT.md): Setup and workflow for developers

### API Server Documentation

The API server provides REST endpoints for the frontend to query indexed data.

- [**OpenAPI Specification**](server/openapi.yaml): Full API specification in OpenAPI 3.0 format

## Quick Start

For new developers, we recommend reading the documents in the following order:

1. [Architecture Overview](indexer/ARCHITECTURE.md) - Start with the high-level architecture
2. [Development Guide](indexer/DEVELOPMENT.md) - Set up your development environment
3. [Database Schema](indexer/DATABASE.md) - Understand the data model
4. [Processor Architecture](indexer/PROCESSOR.md) - Learn about how events are processed
5. [API Specification](server/openapi.yaml) - Explore the available API endpoints

## Diagrams

Architectural diagrams are located in the `indexer/assets` directory:

- `pdp-arch.png` - Overall system architecture diagram

## Contributing to Documentation

When contributing to the documentation:

1. Maintain consistent formatting and style
2. Update diagrams when architecture changes
3. Keep code examples up-to-date with the codebase
4. Add new documents for significant new features

## Related Resources

- [Project Repository](https://github.com/FilOzone/pdp-explorer)
- [Issue Tracker](https://github.com/FilOzone/pdp-explorer/issues)
- [Filecoin Documentation](https://docs.filecoin.io/)
