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

export const contractAddresses = {
  PDPVerifier: '0x159C8b1FBFB7240Db85A1d75cf0B2Cc7C09f932d',
  SimplePDPService: '0x7F0dCeA9D4FB65Cc5801Dc5dfc71b4Ae006484D0',
}
