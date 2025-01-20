package indexer

func (i *Indexer) getLastBlock() uint64 {
	i.mutex.RLock()
	defer i.mutex.RUnlock()
	return i.lastBlock
}

func (i *Indexer) setLastBlock(block uint64) {
	i.mutex.Lock()
	defer i.mutex.Unlock()
	i.lastBlock = block
}
