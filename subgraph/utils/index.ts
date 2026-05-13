// Import network-specific contract constants from generated constants
export { ContractConstants } from "../src/generated/constants";

export const NumChallenges = 5;

export const LeafSize = 32;

// Maximum ProvingWindow entities created per NextProvingPeriod event.
// Prevents OOM when a stale dataset resumes after many skipped periods.
export const MaxProvingWindowsPerEvent = 50;
