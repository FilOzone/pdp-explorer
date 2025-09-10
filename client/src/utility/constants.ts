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
  mainnet: 'https://filfox.info/en',
  calibration: 'https://calibration.filfox.info/en',
}

export const explorerUrl =
  explorerUrls[import.meta.env.VITE_NETWORK || 'calibration']

// PDP contract addresses
export const contractAddresses = {
  PDPVerifier:
    import.meta.env.VITE_PDP_VERIFIER ||
    '0x445238Eca6c6aB8Dff1Aa6087d9c05734D22f137',
  SimplePDPService:
    import.meta.env.VITE_PDP_SERVICE ||
    '0x16b6E7ec316aF33504c8783c73Fb29dC61f6A347',
}
