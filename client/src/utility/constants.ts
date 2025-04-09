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

const explorerUrls = {
  mainnet: 'https://filfox.com/en',
  calibration: 'https://calibration.filfox.info/en',
}

export const explorerUrl =
  explorerUrls[import.meta.env.VITE_NETWORK || 'calibration']

// PDP contract addresses
export const contractAddresses = {
  PDPVerifier:
    import.meta.env.VITE_PDP_VERIFIER ||
    '0x5A23b7df87f59A291C26A2A1d684AD03Ce9B68DC',
  SimplePDPService:
    import.meta.env.VITE_PDP_SERVICE ||
    '0x6170dE2b09b404776197485F3dc6c968Ef948505',
}
