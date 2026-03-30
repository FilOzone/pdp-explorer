export const PDPVerifierAddress = "0x85e366Cf9DD2c0aE37E963d9556F5f4718d6417C";

export const NumChallenges = 5;

export const LeafSize = 32;

// Proving period configuration per network.
// calibration: MaxProvingPeriod=240
// mainnet:      MaxProvingPeriod=2880
export const MaxProvingPeriod = 240;
export const ChallengeWindowSize = 20;

// Maximum ProvingWindow entities created per NextProvingPeriod event.
// Prevents OOM when a stale dataset resumes after many skipped periods.
export const MaxProvingWindowsPerEvent = 50;
