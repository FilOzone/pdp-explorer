import { BigInt, Bytes, crypto, Address } from "@graphprotocol/graph-ts";
import { FaultRecord as FaultRecordEvent } from "../generated/PDPService/PDPService";
import {
  PDPVerifier,
  PDPVerifier__findRootIdsResultValue0Struct,
} from "../generated/PDPVerifier/PDPVerifier";
import { PDPVerifierAddress, NumChallenges } from "../utils";
import {
  EventLog,
  ProofSet,
  Provider,
  FaultRecord,
  Root,
} from "../generated/schema";

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
  // seed: 32 bytes
  // proofSetID: big-endian, 32 bytes
  // proofIndex: big-endian, 8 bytes
  const data = new Uint8Array(32 + 32 + 8);

  // Copy seed
  data.set(seed, 0);

  // proofSetID to 32 bytes big-endian
  const psIDBuf = padTo32Bytes(Bytes.fromBigInt(proofSetID));
  data.set(psIDBuf, 32);

  // proofIndex to 8 bytes big-endian
  const idxBuf = Bytes.fromI32(proofIndex);
  data.set(idxBuf, 64);

  // Keccak-256
  const hashBytes = crypto.keccak256(Bytes.fromUint8Array(data));

  // Convert hash to bigint, mod totalLeaves
  const hashInt = BigInt.fromByteArray(hashBytes);
  const challengeIndex = hashInt.mod(totalLeaves);
  return challengeIndex;
}

export function findChallengedRoots(
  proofSetId: BigInt,
  nextChallengeEpoch: BigInt,
  totalLeaves: BigInt,
  blockNumber: BigInt
): BigInt[] {
  const instance = PDPVerifier.bind(
    Address.fromBytes(Bytes.fromHexString(PDPVerifierAddress))
  );

  const seedInt = instance.getRandomness(nextChallengeEpoch);
  const seed = Bytes.fromBigInt(seedInt);
  if (seed.length === 0) {
    return [];
  }

  const challenges: BigInt[] = [];
  for (let i = 0; i < NumChallenges; i++) {
    const leafIdx = generateChallengeIndex(
      seed,
      proofSetId,
      i32(i),
      totalLeaves
    );
    challenges.push(leafIdx);
  }

  const rootIds = instance.findRootIds(proofSetId, challenges);
  const rootIdsArray: BigInt[] = [];
  for (let i = 0; i < rootIds.length; i++) {
    rootIdsArray.push(rootIds[i].rootId);
  }
  return rootIdsArray;
}

export function handleFaultRecord(event: FaultRecordEvent): void {
  const nextChallengeEpoch = BigInt.fromI32(event.transaction.input[4 + 32]);

  const setId = event.params.proofSetId;

  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const eventLog = new EventLog(eventId);
  eventLog.setId = setId;
  eventLog.address = event.address;
  eventLog.name = "FaultRecord";
  eventLog.data =
    "{proofSetId:" +
    setId.toString() +
    ",periodsFaulted:" +
    event.params.periodsFaulted.toString() +
    ",deadline:" +
    event.params.deadline.toString() +
    "}";
  eventLog.logIndex = event.logIndex;
  eventLog.transactionHash = event.transaction.hash;
  eventLog.createdAt = event.block.timestamp;
  eventLog.blockNumber = event.block.number;
  eventLog.save();

  const setIdBA = Bytes.fromBigInt(setId);
  const proofSet = ProofSet.load(Bytes.fromByteArray(setIdBA));

  if (!proofSet) return;

  const challengeEpoch = proofSet.nextChallengeEpoch;
  const proofSetOwner = proofSet.owner;
  const totalLeaves = proofSet.challengeRange;

  proofSet.totalFaultedPeriods = proofSet.totalFaultedPeriods.plus(
    event.params.periodsFaulted
  );
  proofSet.updatedAt = event.block.timestamp;
  proofSet.blockNumber = event.block.number;
  proofSet.save();

  const provider = Provider.load(proofSetOwner);
  if (!provider) return;

  provider.totalFaultedPeriods = provider.totalFaultedPeriods.plus(
    event.params.periodsFaulted
  );
  provider.updatedAt = event.block.timestamp;
  provider.blockNumber = event.block.number;
  provider.save();

  const rootIds = findChallengedRoots(
    setId,
    challengeEpoch,
    totalLeaves,
    event.block.number
  );
  if (rootIds.length === 0) return;

  // get unique rootIds
  let uniqueRootIds: BigInt[] = [];
  for (let i = 0; i < rootIds.length; i++) {
    let isDuplicate = false;
    for (let j = 0; j < uniqueRootIds.length; j++) {
      if (uniqueRootIds[j] == rootIds[i]) {
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) {
      uniqueRootIds.push(rootIds[i]);
    }
  }

  for (let i = 0; i < uniqueRootIds.length; i++) {
    const rootId = uniqueRootIds[i];
    const id = Bytes.fromBigInt(setId).concatI32(rootId.toI32());
    const root = Root.load(Bytes.fromByteArray(id));
    if (!root) return;

    root.totalPeriodsFaulted = root.totalPeriodsFaulted.plus(
      event.params.periodsFaulted
    );
    root.lastFaultedEpoch = event.block.number;
    root.lastFaultedAt = event.block.timestamp;
    root.updatedAt = event.block.timestamp;
    root.blockNumber = event.block.number;
    root.save();
  }

  const faultRecord = new FaultRecord(eventId);
  faultRecord.proofSetId = setId;
  faultRecord.rootIds = rootIds;
  faultRecord.currentChallengeEpoch = challengeEpoch;
  faultRecord.nextChallengeEpoch = nextChallengeEpoch;
  faultRecord.periodsFaulted = event.params.periodsFaulted;
  faultRecord.deadline = event.params.deadline;
  faultRecord.createdAt = event.block.timestamp;
  faultRecord.blockNumber = event.block.number;
  faultRecord.save();
}
