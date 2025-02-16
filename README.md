# PDP Explorer
Data model and UI for exploring the PDP hot storage network

## Documentation

Detailed documentation is available in the following files:

- [System Architecture](docs/ARCHITECTURE.md) - Overview of the system components and their interactions
- [Processor Design](docs/PROCESSOR.md) - Details about the event/transaction processing pipeline
- [Chain Reorganization Handling](docs/REORG_HANDLING.md) - How the system handles chain reorganizations

## Mockup

This is a first draft at what the PDP explorer will look like ![pdpexplorer](https://github.com/user-attachments/assets/e0595422-fa77-490b-ab57-0c9516ea5d8a)

# Usage

A few user journeys: 
As a user storing data with PDP I can use the explorer to: 
* Check if my SP has had any faults.  And I can check which data in particular was faulted
* Validate that all of the data added to my proofset is data that I asked to store, not anything else
* Look at fault rate of SPs in the network when deciding who to store my data with
* Learn about data that has been removed from my proofset
  
