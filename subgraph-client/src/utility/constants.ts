export const trackedEvents = [
  'ProofSetCreated',
  'ProofSetOwnerChanged',
  'ProofSetDeleted',
  'ProofSetEmpty',
  'PossessionProven',
  'FaultRecord',
  'NextProvingPeriod',
  'RootsAdded',
  'RootsRemoved',
  'ProofFeePaid',
]

export const trackedMethods = [
  'createProofSet',
  'proposeProofSetOwner',
  'claimProofSetOwnership',
  'deleteProofSet',
  'addRoots',
  'scheduleRemovals',
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
      '0x5A23b7df87f59A291C26A2A1d684AD03Ce9B68DC',
    SimplePDPService:
      import.meta.env.VITE_CALIBRATION_PDP_SERVICE ||
      '0x6170dE2b09b404776197485F3dc6c968Ef948505',
  },
}
