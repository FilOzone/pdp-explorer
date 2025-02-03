export const dummyProviders = {
  data: [
    {
      providerId: 'f01234',
      activeProofSets: 25,
      dataSizeStored: 1099511627776, // 1TB in bytes
      faults: 2,
      firstSeen: '2023-01-15T08:00:00Z',
      lastSeen: '2024-03-20T15:30:00Z',
    },
    {
      providerId: 'f05678',
      activeProofSets: 15,
      dataSizeStored: 549755813888, // 512GB in bytes
      faults: 0,
      firstSeen: '2023-03-20T10:00:00Z',
      lastSeen: '2024-03-20T16:45:00Z',
    },
  ],
  metadata: {
    total: 150,
    offset: 0,
    limit: 10,
  },
}

export const dummyProofSets = {
  data: [
    {
      proofSetId: 'ps-123456',
      providerId: 'f01234',
      size: 1073741824, // 1GB in bytes
      proofsSubmitted: 150,
      faults: 1,
      lastProofReceived: '2024-03-20T16:00:00Z',
    },
    {
      proofSetId: 'ps-789012',
      providerId: 'f05678',
      size: 536870912, // 512MB in bytes
      proofsSubmitted: 75,
      faults: 0,
      lastProofReceived: '2024-03-20T15:45:00Z',
    },
  ],
  metadata: {
    total: 200,
    offset: 0,
    limit: 10,
  },
}

const createHeatmapData = () => {
  const rows = 5
  const cols = 7
  return Array(rows)
    .fill(null)
    .map(() =>
      Array(cols)
        .fill(null)
        .map(() => ({
          status: ['idle', 'success', 'failed'][Math.floor(Math.random() * 3)],
          rootPieceId: 'root-' + Math.random().toString(36).substr(2, 9),
        }))
    )
}

export const dummyProofSetDetails = {
  proofSetId: 'ps-123456',
  providerId: 'f01234',
  createTime: '2024-01-15T08:00:00Z',
  deletionTime: null,
  latestTx: '0x123...abc',
  size: 1073741824, // 1GB in bytes
  proofsSubmitted: 150,
  faults: 2,
  transactions: [
    {
      type: 'rootsAdded',
      time: '2024-03-20T15:30:00Z',
      txHash: '0x123...abc',
      status: 'success',
    },
    {
      type: 'possessionProven',
      time: '2024-03-20T16:00:00Z',
      txHash: '0x456...def',
      status: 'success',
    },
  ],
  heatmap: createHeatmapData(),
}
