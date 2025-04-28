import { BigInt, Bytes, crypto, Address, log } from "@graphprotocol/graph-ts";
import { FaultRecord as FaultRecordEvent } from "../generated/PDPService/PDPService";
import { PDPVerifier } from "../generated/PDPVerifier/PDPVerifier";
import { PDPVerifierAddress, NumChallenges } from "../utils";
import {
  EventLog,
  ProofSet,
  Provider,
  FaultRecord,
  Root,
} from "../generated/schema";
import {
  saveNetworkMetrics,
  saveProviderMetrics,
  saveProofSetMetrics,
} from "./helper";
import { SumTree } from "./sumTree";

// --- Helper Functions
function getProofSetEntityId(setId: BigInt): Bytes {
  return Bytes.fromByteArray(Bytes.fromBigInt(setId));
}

function getRootEntityId(setId: BigInt, rootId: BigInt): Bytes {
  return Bytes.fromUTF8(setId.toString() + "-" + rootId.toString());
}

function getTransactionEntityId(txHash: Bytes): Bytes {
  return txHash;
}

function getEventLogEntityId(txHash: Bytes, logIndex: BigInt): Bytes {
  return txHash.concatI32(logIndex.toI32());
}
// --- End Helper Functions

/**
 * Pads a Buffer or Uint8Array to 32 bytes with leading zeros.
 */
function padTo32Bytes(input: Uint8Array): Uint8Array {
  if (input.length >= 32) return input;
  const out = new Uint8Array(32);
  out.set(input, 32 - input.length);
  return out;
}

/**
 * Generates a deterministic challenge index using seed, proofSetID, proofIndex, and totalLeaves.
 * Mirrors the logic from Go's generateChallengeIndex.
 */
export function generateChallengeIndex(
  seed: Uint8Array,
  proofSetID: BigInt,
  proofIndex: i32,
  totalLeaves: BigInt
): BigInt {
  const data = new Uint8Array(32 + 32 + 8);

  // Ensure seed is 32 bytes. Log if not, but proceed cautiously.
  if (seed.length != 32) {
    log.warning("generateChallengeIndex: Seed length is not 32 bytes: {}", [
      seed.length.toString(),
    ]);
  }

  // Only copy up to 32 bytes, or less if seed is shorter.
  data.set(seed.slice(0, 32), 0);

  // Convert proofSetID to Bytes and pad to 32 bytes (Big-Endian padding implied by padTo32Bytes)
  const psIDBytes = Bytes.fromBigInt(proofSetID);
  const psIDPadded = padTo32Bytes(psIDBytes);
  data.set(psIDPadded, 32); // Write 32 bytes at offset 32

  // Convert proofIndex (i32) to an 8-byte Uint8Array (uint64 Big-Endian)
  const idxBuf = new Uint8Array(8); // Create 8-byte buffer, initialized to zeros
  idxBuf[7] = u8(proofIndex & 0xff); // Least significant byte
  idxBuf[6] = u8((proofIndex >> 8) & 0xff);
  idxBuf[5] = u8((proofIndex >> 16) & 0xff);
  idxBuf[4] = u8((proofIndex >> 24) & 0xff); // Most significant byte of the i32

  data.set(idxBuf, 64); // Write the 8 bytes at offset 64

  const hashBytes = crypto.keccak256(Bytes.fromUint8Array(data));
  // hashBytes is big-endian, so expected to be reversed
  const hashIntUnsignedR = BigInt.fromUnsignedBytes(
    Bytes.fromUint8Array(Bytes.fromHexString(hashBytes.toHexString()).reverse())
  );

  if (totalLeaves.isZero()) {
    log.error(
      "generateChallengeIndex: totalLeaves is zero, cannot calculate modulus. ProofSetID: {}. Seed: {}",
      [proofSetID.toString(), Bytes.fromUint8Array(seed).toHex()]
    );
    return BigInt.fromI32(0);
  }

  const challengeIndex = hashIntUnsignedR.mod(totalLeaves);
  return challengeIndex;
}

export function ensureEvenHex(value: BigInt): string {
  const hexRaw = value.toHex().slice(2);
  let paddedHex = hexRaw;
  if (hexRaw.length % 2 === 1) {
    paddedHex = "0" + hexRaw;
  }
  return "0x" + paddedHex;
}

export function findChallengedRoots(
  proofSetId: BigInt,
  nextRootId: BigInt,
  challengeEpoch: BigInt,
  totalLeaves: BigInt,
  blockNumber: BigInt
): BigInt[] {
  const instance = PDPVerifier.bind(
    Address.fromBytes(Bytes.fromHexString(PDPVerifierAddress))
  );

  const seedInt = instance.getRandomness(challengeEpoch);
  const seedHex = ensureEvenHex(seedInt);

  if (!seedInt) {
    log.warning("findChallengedRoots: Failed to get randomness for epoch {}", [
      challengeEpoch.toString(),
    ]);
    return [];
  }

  const challenges: BigInt[] = [];
  if (totalLeaves.isZero()) {
    log.warning(
      "findChallengedRoots: totalLeaves is zero for ProofSet {}. Cannot generate challenges.",
      [proofSetId.toString()]
    );
    return [];
  }
  for (let i = 0; i < NumChallenges; i++) {
    const leafIdx = generateChallengeIndex(
      Bytes.fromHexString(seedHex),
      proofSetId,
      i32(i),
      totalLeaves
    );
    challenges.push(leafIdx);
  }

  const sumTreeInstance = new SumTree();
  const rootIds = sumTreeInstance.findRootIds(
    proofSetId.toI32(),
    nextRootId.toI32(),
    challenges,
    blockNumber
  );
  if (!rootIds) {
    log.warning("findChallengedRoots: findRootIds reverted for proofSetId {}", [
      proofSetId.toString(),
    ]);
    return [];
  }

  const rootIdsArray: BigInt[] = [];
  for (let i = 0; i < rootIds.length; i++) {
    rootIdsArray.push(rootIds[i].rootId);
  }
  return rootIdsArray;
}

// Updated Handler
export function handleFaultRecord(event: FaultRecordEvent): void {
  const setId = event.params.proofSetId;
  const periodsFaultedParam = event.params.periodsFaulted;
  const proofSetEntityId = getProofSetEntityId(setId);
  const entityId = getEventLogEntityId(event.transaction.hash, event.logIndex);
  const transactionEntityId = getTransactionEntityId(event.transaction.hash);

  const proofSet = ProofSet.load(proofSetEntityId);
  if (!proofSet) {
    log.warning("handleFaultRecord: ProofSet {} not found for event tx {}", [
      setId.toString(),
      event.transaction.hash.toHex(),
    ]);
    return;
  }
  const challengeEpoch = proofSet.nextChallengeEpoch;
  const challengeRange = proofSet.challengeRange;
  const proofSetOwner = proofSet.owner;
  const nextRootId = proofSet.totalRoots;

  const eventLog = new EventLog(entityId);
  eventLog.setId = setId;
  eventLog.address = event.address;
  eventLog.name = "FaultRecord";
  eventLog.data = `{"proofSetId":"${setId.toString()}","periodsFaulted":"${periodsFaultedParam.toString()}","deadline":"${event.params.deadline.toString()}"}`;
  eventLog.logIndex = event.logIndex;
  eventLog.transactionHash = event.transaction.hash;
  eventLog.createdAt = event.block.timestamp;
  eventLog.blockNumber = event.block.number;
  eventLog.proofSet = proofSetEntityId;
  eventLog.transaction = transactionEntityId;

  let nextChallengeEpoch = BigInt.fromI32(0);
  const inputData = event.transaction.input;
  if (inputData.length >= 4 + 32) {
    const potentialNextEpochBytes = inputData.slice(4 + 32, 4 + 32 + 32);
    if (potentialNextEpochBytes.length == 32) {
      // Convert reversed Uint8Array to Bytes before converting to BigInt
      nextChallengeEpoch = BigInt.fromUnsignedBytes(
        Bytes.fromUint8Array(potentialNextEpochBytes.reverse())
      );
    }
  } else {
    log.warning(
      "handleFaultRecord: Transaction input data too short to parse potential nextChallengeEpoch.",
      []
    );
  }

  const rootIds = findChallengedRoots(
    setId,
    nextRootId,
    challengeEpoch,
    challengeRange,
    event.block.number
  );

  if (rootIds.length === 0) {
    log.info(
      "handleFaultRecord: No roots found for challenge epoch {} in ProofSet {}",
      [challengeEpoch.toString(), setId.toString()]
    );
  }

  let uniqueRootIds: BigInt[] = [];
  let rootIdMap = new Map<string, boolean>();
  for (let i = 0; i < rootIds.length; i++) {
    const rootIdStr = rootIds[i].toString();
    if (!rootIdMap.has(rootIdStr)) {
      uniqueRootIds.push(rootIds[i]);
      rootIdMap.set(rootIdStr, true);
    }
  }

  let rootEntityIds: Bytes[] = [];
  for (let i = 0; i < uniqueRootIds.length; i++) {
    const rootId = uniqueRootIds[i];
    const rootEntityId = getRootEntityId(setId, rootId);

    const root = Root.load(rootEntityId);
    if (root) {
      if (!root.lastFaultedEpoch.equals(challengeEpoch)) {
        root.totalPeriodsFaulted =
          root.totalPeriodsFaulted.plus(periodsFaultedParam);
      } else {
        log.info(
          "handleFaultRecord: Root {} in Set {} already marked faulted for epoch {}",
          [rootId.toString(), setId.toString(), challengeEpoch.toString()]
        );
      }
      root.lastFaultedEpoch = challengeEpoch;
      root.lastFaultedAt = event.block.timestamp;
      root.updatedAt = event.block.timestamp;
      root.blockNumber = event.block.number;
      root.save();
    } else {
      log.warning(
        "handleFaultRecord: Root {} for Set {} not found while recording fault",
        [rootId.toString(), setId.toString()]
      );
    }
    rootEntityIds.push(rootEntityId);
  }

  const faultRecord = new FaultRecord(entityId);
  faultRecord.proofSetId = setId;
  faultRecord.rootIds = uniqueRootIds;
  faultRecord.currentChallengeEpoch = challengeEpoch;
  faultRecord.nextChallengeEpoch = nextChallengeEpoch;
  faultRecord.periodsFaulted = periodsFaultedParam;
  faultRecord.deadline = event.params.deadline;
  faultRecord.createdAt = event.block.timestamp;
  faultRecord.blockNumber = event.block.number;

  faultRecord.proofSet = proofSetEntityId;
  faultRecord.roots = rootEntityIds;

  faultRecord.save();
  eventLog.save();

  proofSet.totalFaultedPeriods =
    proofSet.totalFaultedPeriods.plus(periodsFaultedParam);
  proofSet.totalFaultedRoots = proofSet.totalFaultedRoots.plus(
    BigInt.fromI32(uniqueRootIds.length)
  );
  proofSet.totalEventLogs = proofSet.totalEventLogs.plus(BigInt.fromI32(1));
  proofSet.updatedAt = event.block.timestamp;
  proofSet.blockNumber = event.block.number;
  proofSet.save();

  const provider = Provider.load(proofSetOwner);
  if (provider) {
    provider.totalFaultedPeriods =
      provider.totalFaultedPeriods.plus(periodsFaultedParam);
    provider.totalFaultedRoots = provider.totalFaultedRoots.plus(
      BigInt.fromI32(uniqueRootIds.length)
    );
    provider.updatedAt = event.block.timestamp;
    provider.blockNumber = event.block.number;
    provider.save();
  } else {
    log.warning("handleFaultRecord: Provider {} not found for ProofSet {}", [
      proofSetOwner.toHex(),
      setId.toString(),
    ]);
  }

  // Update network metrics
  const keys = ["totalFaultedPeriods", "totalFaultedRoots"];
  const values = [periodsFaultedParam, BigInt.fromI32(uniqueRootIds.length)];
  const methods = ["add", "add"];
  saveNetworkMetrics(keys, values, methods);

  // Update provider and proof set metrics
  const weekId = event.block.timestamp.toI32() / 604800;
  const monthId = event.block.timestamp.toI32() / 2592000;
  const providerId = proofSet.owner;
  const weeklyProviderId = Bytes.fromI32(weekId).concat(providerId);
  const monthlyProviderId = Bytes.fromI32(monthId).concat(providerId);
  const weeklyProofSetId = Bytes.fromI32(weekId).concat(proofSetEntityId);
  const monthlyProofSetId = Bytes.fromI32(monthId).concat(proofSetEntityId);
  saveProviderMetrics(
    "WeeklyProviderActivity",
    weeklyProviderId,
    providerId,
    ["totalFaultedPeriods", "totalFaultedRoots"],
    [periodsFaultedParam, BigInt.fromI32(uniqueRootIds.length)],
    ["add", "add"]
  );
  saveProviderMetrics(
    "MonthlyProviderActivity",
    monthlyProviderId,
    providerId,
    ["totalFaultedPeriods", "totalFaultedRoots"],
    [periodsFaultedParam, BigInt.fromI32(uniqueRootIds.length)],
    ["add", "add"]
  );
  saveProofSetMetrics(
    "WeeklyProofSetActivity",
    weeklyProofSetId,
    setId,
    ["totalFaultedPeriods", "totalFaultedRoots"],
    [periodsFaultedParam, BigInt.fromI32(uniqueRootIds.length)],
    ["add", "add"]
  );
  saveProofSetMetrics(
    "MonthlyProofSetActivity",
    monthlyProofSetId,
    setId,
    ["totalFaultedPeriods", "totalFaultedRoots"],
    [periodsFaultedParam, BigInt.fromI32(uniqueRootIds.length)],
    ["add", "add"]
  );
}
