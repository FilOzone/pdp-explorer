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
import { saveNetworkMetrics } from "./helper";

// --- Helper Functions
function getProofSetEntityId(setId: BigInt): Bytes {
  return Bytes.fromBigInt(setId) as Bytes;
}

function getRootEntityId(setId: BigInt, rootId: BigInt): Bytes {
  return Bytes.fromBigInt(setId).concat(Bytes.fromBigInt(rootId)) as Bytes;
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

  data.set(seed, 0);

  const psIDBuf = padTo32Bytes(
    Bytes.fromUint8Array(Bytes.fromBigInt(proofSetID))
  );
  data.set(psIDBuf, 32);

  const idxBuf = padTo32Bytes(Bytes.fromUint8Array(Bytes.fromI32(proofIndex)));
  data.set(idxBuf, 64);

  const hashBytes = crypto.keccak256(Bytes.fromUint8Array(data));

  const hashInt = BigInt.fromByteArray(hashBytes);
  if (totalLeaves.isZero()) {
    log.error(
      "generateChallengeIndex: totalLeaves is zero, cannot calculate modulus. ProofSetID: {}. Seed: {}",
      [proofSetID.toString(), Bytes.fromUint8Array(seed).toHex()]
    );
    return BigInt.fromI32(0);
  }
  const challengeIndex = hashInt.mod(totalLeaves);
  return challengeIndex;
}

export function findChallengedRoots(
  proofSetId: BigInt,
  challengeEpoch: BigInt,
  totalLeaves: BigInt
): BigInt[] {
  const instance = PDPVerifier.bind(
    Address.fromBytes(Bytes.fromHexString(PDPVerifierAddress))
  );

  const seedInt = instance.try_getRandomness(challengeEpoch);
  if (seedInt.reverted || seedInt.value.isZero()) {
    log.warning("findChallengedRoots: Failed to get randomness for epoch {}", [
      challengeEpoch.toString(),
    ]);
    return [];
  }
  const seed = Bytes.fromBigInt(seedInt.value);

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
      seed,
      proofSetId,
      i32(i),
      totalLeaves
    );
    challenges.push(leafIdx);
  }

  const rootIdsResult = instance.try_findRootIds(proofSetId, challenges);
  if (rootIdsResult.reverted) {
    log.warning("findChallengedRoots: findRootIds reverted for proofSetId {}", [
      proofSetId.toString(),
    ]);
    return [];
  }

  const rootIds = rootIdsResult.value;
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
      nextChallengeEpoch = BigInt.fromUnsignedBytes(
        potentialNextEpochBytes.reverse() as Bytes
      );
      log.info("handleFaultRecord: Parsed potential nextChallengeEpoch: {}", [
        nextChallengeEpoch.toString(),
      ]);
    } else {
      log.warning(
        "handleFaultRecord: Could not slice expected 32 bytes for nextChallengeEpoch from input data.",
        []
      );
    }
  } else {
    log.warning(
      "handleFaultRecord: Transaction input data too short to parse potential nextChallengeEpoch.",
      []
    );
  }

  const rootIds = findChallengedRoots(setId, challengeEpoch, challengeRange);

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

  log.info(
    "handleFaultRecord: Found {} unique roots potentially faulted for epoch {} in ProofSet {}",
    [
      uniqueRootIds.length.toString(),
      challengeEpoch.toString(),
      setId.toString(),
    ]
  );

  let actualFaultsRecorded = 0;
  let rootEntityIds: Bytes[] = [];
  for (let i = 0; i < uniqueRootIds.length; i++) {
    const rootId = uniqueRootIds[i];
    const rootEntityId = getRootEntityId(setId, rootId);

    const root = Root.load(rootEntityId);
    if (root) {
      if (!root.lastFaultedEpoch.equals(challengeEpoch)) {
        root.totalPeriodsFaulted = root.totalPeriodsFaulted.plus(
          BigInt.fromI32(1)
        );
        actualFaultsRecorded += 1;
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

  if (actualFaultsRecorded > 0) {
    proofSet.totalFaultedPeriods = proofSet.totalFaultedPeriods.plus(
      BigInt.fromI32(actualFaultsRecorded)
    );
    proofSet.updatedAt = event.block.timestamp;
    proofSet.blockNumber = event.block.number;
    proofSet.save();

    const provider = Provider.load(proofSetOwner);
    if (provider) {
      provider.totalFaultedPeriods = provider.totalFaultedPeriods.plus(
        BigInt.fromI32(actualFaultsRecorded)
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
  } else {
    log.info(
      "handleFaultRecord: No new root faults recorded for epoch {} in ProofSet {}",
      [challengeEpoch.toString(), setId.toString()]
    );
  }

  // Update network metrics
  const keys = ["totalFaultedPeriods", "totalFaultedRoots"];
  const values = [periodsFaultedParam, BigInt.fromI32(uniqueRootIds.length)];
  const methods = ["add", "add"];
  saveNetworkMetrics(keys, values, methods);
}
