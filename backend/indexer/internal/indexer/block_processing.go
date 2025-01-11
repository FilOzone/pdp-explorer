package indexer

import (
	"context"
	"fmt"
	"log"
)

func (i *Indexer) processBatch(ctx context.Context, startBlock, safeBlock uint64) error {
	endBlock := safeBlock
	if endBlock-startBlock > maxBatchSize {
		endBlock = startBlock + maxBatchSize
	}

	log.Printf("Processing blocks from %d to %d (batch size: %d)",
		startBlock, endBlock, endBlock-startBlock+1)

	processed := 0
	for blockNum := startBlock; blockNum <= endBlock; blockNum++ {
		if err := i.processBlock(ctx, blockNum); err != nil {
			log.Printf("Error processing block %d: %v", blockNum, err)
			return err
		}
		i.setLastBlock(blockNum)
		processed++
	}

	log.Printf("Successfully processed %d blocks from %d to %d",
		processed, startBlock, endBlock)
	return nil
}

func (i *Indexer) processBlock(ctx context.Context, blockNum uint64) error {
	var tipset struct {
		Cids []struct {
			Slash string `json:"/"`
		} `json:"Cids"`
	}

	params := []interface{}{
		blockNum,
		nil,
	}

	err := i.callRPC("Filecoin.ChainGetTipSetByHeight", params, &tipset)
	if err != nil {
		return fmt.Errorf("failed to get tipset at height %d: %w", blockNum, err)
	}

	if len(tipset.Cids) == 0 {
		return fmt.Errorf("no cids found for block %d", blockNum)
	}

	// Store block in database
	query := `
		INSERT INTO blocks (height, cid, timestamp)
		VALUES ($1, $2, NOW())
		ON CONFLICT (height) DO NOTHING
	`
	_, err = i.db.ExecContext(ctx, query, blockNum, tipset.Cids[0].Slash)
	if err != nil {
		return fmt.Errorf("failed to store block %d: %w", blockNum, err)
	}

	log.Printf("Processed and stored block %d with CID %s", blockNum, tipset.Cids[0].Slash)
	return nil
}
