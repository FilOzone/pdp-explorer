export const trackedEvents = [
  'DataSetCreated',
  'StorageProviderChanged',
  'DataSetDeleted',
  'DataSetDeleted',
  'PossessionProven',
  'FaultRecord',
  'NextProvingPeriod',
  'piecesAdded',
  'PiecesRemoved',
  'ProofFeePaid',
]

export const trackedMethods = [
  'createDataSet',
  'proposeDataSetStorageProvider',
  'claimDataSetStorageProvider',
  'deleteDataSet',
  'addPieces',
  'schedulePieceDeletions',
  'provePossession',
  'nextProvingPeriod',
]

export const explorerUrls = {
  mainnet: 'https://filfox.info/en',
  calibration: 'https://calibration.filfox.info/en',
}

// PDP contract addresses by network
export const networkContractAddresses = {
  mainnet: {
    PDPVerifier:
      import.meta.env.VITE_MAINNET_PDP_VERIFIER ||
      '0x9C65E8E57C98cCc040A3d825556832EA1e9f4Df6',
    SimplePDPService:
      import.meta.env.VITE_MAINNET_PDP_SERVICE ||
      '0x805370387fA5Bd8053FD8f7B2da4055B9a4f8019',
  },
  calibration: {
    PDPVerifier:
      import.meta.env.VITE_CALIBRATION_PDP_VERIFIER ||
      '0x85e366Cf9DD2c0aE37E963d9556F5f4718d6417C',
    SimplePDPService:
      import.meta.env.VITE_CALIBRATION_PDP_SERVICE ||
      '0x16b6E7ec316aF33504c8783c73Fb29dC61f6A347',
  },
}
