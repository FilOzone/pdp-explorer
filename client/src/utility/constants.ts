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
