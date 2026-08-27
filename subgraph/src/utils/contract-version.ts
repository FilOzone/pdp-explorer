import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import { ContractVersion } from "../../generated/schema";

const CONTRACT_VERSION_ENTITY_ID = Bytes.fromUTF8("pdp_verifier_version");
const PROCESS_PIECE_DELETIONS_VERSION: i32[] = [3, 5, 0];

export function saveContractVersion(
  version: string,
  implementation: Bytes,
  blockNumber: BigInt,
  timestamp: BigInt,
): void {
  let contractVersion = ContractVersion.load(CONTRACT_VERSION_ENTITY_ID);
  if (contractVersion === null) {
    contractVersion = new ContractVersion(CONTRACT_VERSION_ENTITY_ID);
  }
  contractVersion.version = version;
  contractVersion.implementation = implementation;
  contractVersion.updatedAtBlock = blockNumber;
  contractVersion.updatedAt = timestamp;
  contractVersion.save();
}

function parseVersion(version: string): i32[] {
  const rawParts = version.split(".");
  const parts: i32[] = [0, 0, 0];
  for (let i = 0; i < rawParts.length && i < 3; i++) {
    parts[i] = I32.parseInt(rawParts[i]);
  }
  return parts;
}

function versionAtLeast(version: i32[], threshold: i32[]): boolean {
  for (let i = 0; i < threshold.length; i++) {
    if (version[i] > threshold[i]) return true;
    if (version[i] < threshold[i]) return false;
  }
  return true;
}

export function supportsProcessPieceDeletions(): boolean {
  const contractVersion = ContractVersion.load(CONTRACT_VERSION_ENTITY_ID);
  if (contractVersion === null) return false;

  return versionAtLeast(parseVersion(contractVersion.version), PROCESS_PIECE_DELETIONS_VERSION);
}
