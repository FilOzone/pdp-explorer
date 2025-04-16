import { BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import {
  NextProvingPeriod as NextProvingPeriodEvent,
  PossessionProven as PossessionProvenEvent,
  ProofFeePaid as ProofFeePaidEvent,
  ProofSetCreated as ProofSetCreatedEvent,
  ProofSetEmpty as ProofSetEmptyEvent,
  ProofSetDeleted as ProofSetDeletedEvent,
  ProofSetOwnerChanged as ProofSetOwnerChangedEvent,
  RootsAdded as RootsAddedEvent,
  RootsRemoved as RootsRemovedEvent,
} from "../generated/PDPVerifier/PDPVerifier";
import {
  EventLog,
  Proof,
  ProofFee,
  ProofSet,
  Root,
  Provider,
  Transaction,
} from "../generated/schema";

// Define a class for the structure instead of a type alias
class ParsedRootDetail {
  rootId: BigInt;
  rawSize: BigInt;
  rootBytes: Bytes;
}

export function handleProofSetCreated(event: ProofSetCreatedEvent): void {
  const listenerAddr = Bytes.fromUint8Array(
    event.transaction.input.subarray(16, 36)
  );

  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const eventLog = new EventLog(eventId);
  eventLog.setId = event.params.setId;
  eventLog.address = event.address;
  eventLog.name = "ProofSetCreated";
  eventLog.data =
    "{setId:" +
    event.params.setId.toString() +
    ",owner:" +
    event.params.owner.toHexString() +
    "}";
  eventLog.logIndex = event.logIndex;
  eventLog.transactionHash = event.transaction.hash;
  eventLog.createdAt = event.block.timestamp;
  eventLog.blockNumber = event.block.number;
  eventLog.save();

  const transaction = new Transaction(event.transaction.hash);
  transaction.hash = event.transaction.hash;
  transaction.proofSetId = event.params.setId;
  transaction.height = event.block.number;
  transaction.fromAddress = event.transaction.from;
  transaction.toAddress = event.transaction.to;
  transaction.value = event.transaction.value;
  transaction.method = "createProofSet";
  transaction.status = true;
  transaction.createdAt = event.block.timestamp;
  transaction.save();

  const id = Bytes.fromBigInt(event.params.setId);
  let proofSet = new ProofSet(Bytes.fromByteArray(id));
  proofSet.setId = event.params.setId;
  proofSet.owner = event.params.owner;
  proofSet.listener = listenerAddr;
  proofSet.isActive = true;
  proofSet.leafCount = BigInt.fromI32(0);
  proofSet.challengeRange = BigInt.fromI32(0);
  proofSet.lastProvenEpoch = BigInt.fromI32(0);
  proofSet.nextChallengeEpoch = BigInt.fromI32(0);
  proofSet.totalRoots = BigInt.fromI32(0);
  proofSet.totalDataSize = BigInt.fromI32(0);
  proofSet.totalFeePaid = BigInt.fromI32(0);
  proofSet.totalFaultedPeriods = BigInt.fromI32(0);
  proofSet.totalProvedRoots = BigInt.fromI32(0);
  proofSet.createdAt = event.block.timestamp;
  proofSet.updatedAt = event.block.timestamp;
  proofSet.blockNumber = event.block.number;
  proofSet.save();

  let provider = Provider.load(event.params.owner);
  if (provider) {
    let ids = provider.proofSetIds;
    if (ids == null) {
      ids = [event.params.setId];
    } else {
      ids = ids.concat([event.params.setId]);
    }
    provider.proofSetIds = ids;
    provider.blockNumber = event.block.number;
    provider.createdAt = event.block.timestamp;
    provider.updatedAt = event.block.timestamp;
  } else {
    provider = new Provider(event.params.owner);
    provider.address = event.params.owner;
    provider.totalFaultedPeriods = BigInt.fromI32(0);
    provider.totalDataSize = BigInt.fromI32(0);
    provider.proofSetIds = [event.params.setId];
    provider.blockNumber = event.block.number;
    provider.createdAt = event.block.timestamp;
    provider.updatedAt = event.block.timestamp;
  }
  provider.save();
}

export function handleProofSetDeleted(event: ProofSetDeletedEvent): void {
  const setId = event.params.setId;
  const deletedLeafCount = event.params.deletedLeafCount;
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const eventLog = new EventLog(eventId);
  eventLog.setId = event.params.setId;
  eventLog.address = event.address;
  eventLog.name = "ProofSetDeleted";
  eventLog.data =
    "{setId:" +
    setId.toString() +
    ",deletedLeafCount:" +
    deletedLeafCount.toString() +
    "}";
  eventLog.logIndex = event.logIndex;
  eventLog.transactionHash = event.transaction.hash;
  eventLog.createdAt = event.block.timestamp;
  eventLog.blockNumber = event.block.number;
  eventLog.save();

  const id = Bytes.fromBigInt(setId);
  const proofSet = ProofSet.load(Bytes.fromByteArray(id));
  if (!proofSet) {
    return;
  }
  proofSet.isActive = false;
  proofSet.owner = Bytes.fromI32(0);
  proofSet.totalRoots = BigInt.fromI32(0);
  proofSet.totalDataSize = BigInt.fromI32(0);
  proofSet.nextChallengeEpoch = BigInt.fromI32(0);
  proofSet.lastProvenEpoch = BigInt.fromI32(0);
  proofSet.updatedAt = event.block.timestamp;
  proofSet.blockNumber = event.block.number;
  proofSet.save();

  const provider = Provider.load(proofSet.owner);
  if (!provider) {
    return;
  }
  provider.totalDataSize = provider.totalDataSize.minus(proofSet.totalDataSize);
  const ids = provider.proofSetIds;
  let nextIds: BigInt[] = [];
  if (ids) {
    for (let i = 0; i < ids.length; i++) {
      if (ids[i] != setId) {
        nextIds.push(ids[i]);
      }
    }
  }
  provider.proofSetIds = nextIds;
  provider.updatedAt = event.block.timestamp;
  provider.blockNumber = event.block.number;
  provider.save();
}

export function handleProofSetOwnerChanged(
  event: ProofSetOwnerChangedEvent
): void {
  const setId = event.params.setId;
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const eventLog = new EventLog(eventId);
  eventLog.setId = setId;
  eventLog.address = event.address;
  eventLog.name = "ProofSetOwnerChanged";
  eventLog.data =
    "{setId:" +
    setId.toString() +
    ",oldOwner:" +
    event.params.oldOwner.toHexString() +
    ",newOwner:" +
    event.params.newOwner.toHexString() +
    "}";
  eventLog.logIndex = event.logIndex;
  eventLog.transactionHash = event.transaction.hash;
  eventLog.createdAt = event.block.timestamp;
  eventLog.blockNumber = event.block.number;
  eventLog.save();

  const id = Bytes.fromBigInt(setId);
  const proofSet = ProofSet.load(Bytes.fromByteArray(id));
  if (!proofSet) {
    return;
  }
  proofSet.owner = event.params.newOwner;
  proofSet.updatedAt = event.block.timestamp;
  proofSet.blockNumber = event.block.number;
  proofSet.save();

  const oldProvider = Provider.load(event.params.oldOwner);
  if (oldProvider) {
    const ids = oldProvider.proofSetIds;
    let nextIds: BigInt[] = [];
    if (ids) {
      for (let i = 0; i < ids.length; i++) {
        if (ids[i] != setId) {
          nextIds.push(ids[i]);
        }
      }
    }
    oldProvider.proofSetIds = nextIds;
    oldProvider.totalDataSize = oldProvider.totalDataSize.minus(
      proofSet.totalDataSize
    );
    oldProvider.updatedAt = event.block.timestamp;
    oldProvider.blockNumber = event.block.number;
    oldProvider.save();
  }

  const newProvider = Provider.load(event.params.newOwner);
  if (newProvider) {
    const ids = newProvider.proofSetIds;
    newProvider.proofSetIds = ids ? ids.concat([setId]) : [setId];
    newProvider.totalDataSize = newProvider.totalDataSize.plus(
      proofSet.totalDataSize
    );
    newProvider.updatedAt = event.block.timestamp;
    newProvider.blockNumber = event.block.number;
    newProvider.save();
  } else {
    const newProvider = new Provider(event.params.newOwner);
    newProvider.address = event.params.newOwner;
    newProvider.totalFaultedPeriods = BigInt.fromI32(0);
    newProvider.totalDataSize = proofSet.totalDataSize;
    newProvider.proofSetIds = [setId];
    newProvider.blockNumber = event.block.number;
    newProvider.createdAt = event.block.timestamp;
    newProvider.updatedAt = event.block.timestamp;
    newProvider.save();
  }
}

export function handleProofFeePaid(event: ProofFeePaidEvent): void {
  const setId = event.params.setId;
  const fee = event.params.fee;
  const price = event.params.price;
  const expo = event.params.expo;

  // 1. Create Event Log
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const eventLog = new EventLog(eventId);
  eventLog.setId = setId;
  eventLog.address = event.address;
  eventLog.name = "ProofFeePaid";
  eventLog.data =
    `{setId:${setId.toString()}, ` +
    `fee:${fee.toString()}, ` +
    `price:${price.toString()}, ` +
    `expo:${expo.toString()}}`;
  eventLog.logIndex = event.logIndex;
  eventLog.transactionHash = event.transaction.hash;
  eventLog.createdAt = event.block.timestamp;
  eventLog.blockNumber = event.block.number;
  eventLog.save();

  // 2. Create Proof Fee record
  // Use tx hash + log index as unique ID for the fee payment event
  const proofFeeId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const proofFee = new ProofFee(proofFeeId);
  proofFee.setId = event.params.setId;
  proofFee.proofFee = event.params.fee;
  proofFee.filUsdPrice = event.params.price;
  proofFee.filUsdPriceExponent = BigInt.fromI32(event.params.expo);
  proofFee.createdAt = event.block.timestamp;
  proofFee.blockNumber = event.block.number;
  proofFee.save();

  // 3. Update Proof Set
  const proofSetId = Bytes.fromBigInt(event.params.setId);
  const proofSet = ProofSet.load(Bytes.fromByteArray(proofSetId));
  if (proofSet) {
    proofSet.totalFeePaid = proofSet.totalFeePaid.plus(event.params.fee);
    proofSet.updatedAt = event.block.timestamp;
    proofSet.blockNumber = event.block.number;
    proofSet.save();
  }
}

export function handleProofSetEmpty(event: ProofSetEmptyEvent): void {
  const setId = event.params.setId;

  // 1. Create Event Log
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const eventLog = new EventLog(eventId);
  eventLog.setId = setId;
  eventLog.address = event.address;
  eventLog.name = "ProofSetEmpty";
  eventLog.data = `{setId:${setId.toString()}}`;
  eventLog.logIndex = event.logIndex;
  eventLog.transactionHash = event.transaction.hash;
  eventLog.createdAt = event.block.timestamp;
  eventLog.blockNumber = event.block.number;
  eventLog.save();

  // 2. Update Proof Set
  const proofSetId = Bytes.fromBigInt(setId);
  const proofSet = ProofSet.load(Bytes.fromByteArray(proofSetId));
  if (proofSet) {
    proofSet.totalRoots = BigInt.fromI32(0);
    proofSet.totalDataSize = BigInt.fromI32(0);
    proofSet.lastProvenEpoch = BigInt.fromI32(0);
    proofSet.nextChallengeEpoch = BigInt.fromI32(0);
    proofSet.updatedAt = event.block.timestamp;
    proofSet.blockNumber = event.block.number;
    proofSet.save();
  }
}

export function handlePossessionProven(event: PossessionProvenEvent): void {
  const setId = event.params.setId;
  const challenges = event.params.challenges; // Array of { rootId: BigInt, offset: BigInt }
  const proofSetIdBytes = Bytes.fromBigInt(setId); // Get ProofSet ID early

  // 1. Create Event Log
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const eventLog = new EventLog(eventId);
  eventLog.setId = setId;
  eventLog.address = event.address;
  eventLog.name = "PossessionProven";
  // Store challenges as a simple string representation for the log
  let challengesStr = "[";
  for (let i = 0; i < challenges.length; i++) {
    challengesStr += `{rootId:${challenges[i].rootId.toString()}, offset:${challenges[
      i
    ].offset.toString()}}`;
    if (i < challenges.length - 1) {
      challengesStr += ",";
    }
  }
  challengesStr += "]";
  eventLog.data = `{setId:${setId.toString()}, challenges:${challengesStr}}`;
  eventLog.logIndex = event.logIndex;
  eventLog.transactionHash = event.transaction.hash;
  eventLog.createdAt = event.block.timestamp;
  eventLog.blockNumber = event.block.number;
  eventLog.save();

  const uniqueRootIds = new Set<string>();
  // const proofSetIdBytes = Bytes.fromBigInt(setId); <= Moved up

  // 2. Process Challenges & Create Simplified Proof Entities
  for (let i = 0; i < challenges.length; i++) {
    const challenge = challenges[i];
    const rootId = challenge.rootId;
    const offset = challenge.offset;

    // Create a unique ID for the proof instance within this event
    const proofId = event.transaction.hash
      .concatI32(event.logIndex.toI32())
      .concatI32(i);

    const proof = new Proof(proofId);
    proof.setId = setId; // Reverting to assign Bytes ID - this is standard practice
    proof.rootId = rootId;
    proof.proofOffset = offset;
    proof.provenAt = event.block.timestamp;
    proof.blockNumber = event.block.number;
    proof.save();

    // Track unique root IDs processed in this event
    const rootIdString = rootId.toString();
    uniqueRootIds.add(rootIdString);

    // 3. Update Root Statistics
    // Construct Root entity ID (assuming format: set_id + root_id)
    const rootEntityId = proofSetIdBytes.concatI32(rootId.toI32()); // Adjust if ID format is different
    let root = Root.load(Bytes.fromByteArray(rootEntityId));
    if (root) {
      root.totalProofsSubmitted = root.totalProofsSubmitted.plus(
        BigInt.fromI32(1)
      );
      root.lastProvenEpoch = event.block.number;
      root.lastProvenAt = event.block.timestamp;
      root.updatedAt = event.block.timestamp;
      root.blockNumber = event.block.number;
      root.save();
    } else {
      // Should ideally not happen if RootsAdded is processed first, but log a warning
      log.warning(
        "Root entity not found for setId {} and rootId {} in handlePossessionProven. Tx: {}",
        [setId.toString(), rootId.toString(), event.transaction.hash.toHex()]
      );
    }
  }

  // 4. Update ProofSet Statistics
  const proofSet = ProofSet.load(Bytes.fromByteArray(proofSetIdBytes));
  if (proofSet) {
    // Increment by the number of *unique* roots proven in this event
    // FIXME: Uncomment and adjust field name if 'totalProvedRoots' exists in schema
    proofSet.totalProvedRoots = proofSet.totalProvedRoots.plus(
      BigInt.fromI32(uniqueRootIds.size)
    );
    proofSet.lastProvenEpoch = event.block.number; // Update last proven epoch for the set
    proofSet.updatedAt = event.block.timestamp;
    proofSet.blockNumber = event.block.number;
    proofSet.save();
  } else {
    log.error(
      "ProofSet not found for setId {} in handlePossessionProven. Tx: {}",
      [setId.toString(), event.transaction.hash.toHex()]
    );
  }
}

export function handleNextProvingPeriod(event: NextProvingPeriodEvent): void {
  const setId = event.params.setId;
  const nextChallengeEpoch = event.params.challengeEpoch;
  const leafCount = event.params.leafCount; // Extracted, but not stored on ProofSet currently
  const proofSetId = Bytes.fromBigInt(setId); // Get Bytes ID for linking/loading

  // 1. Create Event Log
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const eventLog = new EventLog(eventId);
  eventLog.setId = setId; // Reverting: Assign ProofSet ID hex string to 'set' field (matches current codegen, but likely needs schema fix)
  eventLog.name = "NextProvingPeriod";
  eventLog.address = event.address;
  eventLog.logIndex = event.logIndex;
  eventLog.blockNumber = event.block.number;
  eventLog.createdAt = event.block.timestamp; // Corrected: Use 'createdAt' field
  eventLog.transactionHash = event.transaction.hash;

  // Store specific event parameters as JSON string
  eventLog.data = `{ "setId": "${setId.toString()}", "nextChallengeEpoch": "${nextChallengeEpoch.toString()}", "leafCount": "${leafCount.toString()}" }`; // Corrected: Manual JSON string

  eventLog.save();

  // 2. Update Proof Set
  const proofSet = ProofSet.load(Bytes.fromByteArray(proofSetId));

  if (proofSet) {
    proofSet.nextChallengeEpoch = nextChallengeEpoch;
    proofSet.challengeRange = leafCount;
    proofSet.updatedAt = event.block.timestamp;
    proofSet.blockNumber = event.block.number;
    proofSet.save();
  } else {
    log.error(
      "ProofSet not found for setId {} in handleNextProvingPeriod. Tx: {}",
      [setId.toString(), event.transaction.hash.toHex()]
    );
  }
}

// Helper function to read Uint256 from Bytes at a specific offset
function readUint256(data: Bytes, offset: i32): BigInt {
  // Ensure offset is valid and there's enough data
  if (offset < 0 || data.length < offset + 32) {
    log.error("readUint256: Invalid offset {} or data length {}", [
      offset.toString(),
      data.length.toString(),
    ]);
    // Return zero or throw? Returning zero might hide issues but prevent crashes.
    return BigInt.zero();
  }
  // Ethereum stores values in big-endian format.
  // BigInt.fromUnsignedBytes expects little-endian, so we reverse the bytes.
  const slicedData = Bytes.fromUint8Array(data.slice(offset, offset + 32));
  // Check if the sliced data is exactly 32 bytes before reversing
  if (slicedData.length != 32) {
    log.error("readUint256: Sliced data not 32 bytes. Offset: {}, Len: {}", [
      offset.toString(),
      slicedData.length.toString(),
    ]);
    return BigInt.zero();
  }
  return BigInt.fromUnsignedBytes(Bytes.fromUint8Array(slicedData.reverse()));
}

// Helper function to read Bytes (dynamic type) from Bytes at a specific offset
function readBytes(data: Bytes, offset: i32): Bytes {
  // Ensure offset is valid
  if (offset < 0 || data.length < offset + 32) {
    log.error(
      "readBytes: Invalid offset {} or data length {} for reading data offset",
      [offset.toString(), data.length.toString()]
    );
    return Bytes.empty();
  }
  const dataOffset = readUint256(data, offset).toI32();

  // Ensure dataOffset is valid
  if (dataOffset < 0 || data.length < dataOffset + 32) {
    log.error(
      "readBytes: Invalid dataOffset {} or data length {} for reading length",
      [dataOffset.toString(), data.length.toString()]
    );
    return Bytes.empty();
  }
  const length = readUint256(data, dataOffset).toI32();

  // Ensure length is non-negative
  if (length < 0) {
    log.error("readBytes: Invalid negative length {} at dataOffset {}", [
      length.toString(),
      dataOffset.toString(),
    ]);
    return Bytes.empty();
  }

  const dataStart = dataOffset + 32;

  // Refined bounds check to avoid problematic casting
  // 1. dataStart must be non-negative.
  // 2. dataStart must be less than data.length to be a valid start index.
  // 3. The remaining length (data.length - dataStart) must be >= the required length.
  if (
    dataStart < 0 ||
    dataStart >= data.length ||
    length > data.length - dataStart
  ) {
    log.error(
      "readBytes: Data slice out of bounds. Start: {}, Length: {}, Data Length: {}",
      [dataStart.toString(), length.toString(), data.length.toString()]
    );
    // If start is valid but length overflows, slice to the end
    if (dataStart >= 0 && dataStart < data.length) {
      return Bytes.fromUint8Array(data.slice(dataStart));
    } else {
      // If start itself is invalid, return empty
      return Bytes.empty();
    }
  }

  return Bytes.fromUint8Array(data.slice(dataStart, dataStart + length));
}

export function handleRootsAdded(event: RootsAddedEvent): void {
  const setId = event.params.setId; // We can still get setId from params for convenience
  const rootIdsFromEvent = event.params.rootIds; // Array of BigInt from event logs
  const proofSetIdBytes = Bytes.fromBigInt(setId);

  const txInput = event.transaction.input;

  // --- 1. Create Event Log ---
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const eventLog = new EventLog(eventId);
  eventLog.setId = setId;
  eventLog.name = "RootsAdded";
  eventLog.address = event.address;
  eventLog.logIndex = event.logIndex;
  eventLog.blockNumber = event.block.number;
  eventLog.createdAt = event.block.timestamp;
  eventLog.transactionHash = event.transaction.hash;
  // Store simple representation of event params
  let rootIdStrings: string[] = [];
  for (let i = 0; i < rootIdsFromEvent.length; i++) {
    rootIdStrings.push(rootIdsFromEvent[i].toString());
  }
  eventLog.data = `{ "setId": "${setId.toString()}", "rootIds": [${rootIdStrings.join(",")}] }`;
  eventLog.save();

  // --- 2. Parse Transaction Input ---
  if (txInput.length < 4) {
    log.error("Invalid tx input length in handleRootsAdded: {}", [
      event.transaction.hash.toHex(),
    ]);
    return;
  }
  // Skip function selector (first 4 bytes)
  const encodedData = Bytes.fromUint8Array(txInput.slice(4));

  let decodedSetId: BigInt;
  let rootsDataOffset: i32;
  let rootsDataLength: i32;

  let totalDataSizeAdded = BigInt.zero();
  let parsedRootDetails: ParsedRootDetail[] = [];

  // Need at least 3 * 32 bytes for setId, offset to rootsData, offset to extraData
  if (encodedData.length < 96) {
    log.error(
      "handleRootsAdded: Encoded data too short for basic structure. Len: {}. Tx: {}",
      [encodedData.length.toString(), event.transaction.hash.toHex()]
    );
    return;
  }

  // Decode setId (uint256 at offset 0)
  decodedSetId = readUint256(encodedData, 0);
  if (decodedSetId != setId) {
    log.warning(
      "Decoded setId {} does not match event param {} in handleRootsAdded. Tx: {}",
      [
        decodedSetId.toString(),
        setId.toString(),
        event.transaction.hash.toHex(),
      ]
    );
    // Continue using setId from event params as it's usually more reliable
  }

  // Decode rootsData (tuple[])
  rootsDataOffset = readUint256(encodedData, 32).toI32(); // Offset is at byte 32

  if (rootsDataOffset < 0 || encodedData.length < rootsDataOffset + 32) {
    log.error(
      "handleRootsAdded: Invalid rootsDataOffset {} or data length {} for reading rootsData length. Tx: {}",
      [
        rootsDataOffset.toString(),
        encodedData.length.toString(),
        event.transaction.hash.toHex(),
      ]
    );
    return;
  }

  rootsDataLength = readUint256(encodedData, rootsDataOffset).toI32(); // Length is at the offset

  if (rootsDataLength < 0) {
    log.error("handleRootsAdded: Invalid negative rootsDataLength {}. Tx: {}", [
      rootsDataLength.toString(),
      event.transaction.hash.toHex(),
    ]);
    return;
  }

  const structsBaseOffset = rootsDataOffset + 32; // Start of struct offsets/data

  // Check for potential overflow before calculating required length
  // Required length calculation needs care for potential overflow if rootsDataLength is huge
  // Let's check if structsBaseOffset itself is valid first
  if (structsBaseOffset < 0 || structsBaseOffset > encodedData.length) {
    log.error("handleRootsAdded: Invalid structsBaseOffset {}. Tx: {}", [
      structsBaseOffset.toString(),
      event.transaction.hash.toHex(),
    ]);
    return;
  }
  // Check if enough space exists for all offsets
  const requiredLengthForOffsets = rootsDataLength * 32;
  if (rootsDataLength > 0 && requiredLengthForOffsets / rootsDataLength != 32) {
    // Check for multiplication overflow
    log.error(
      "handleRootsAdded: Potential overflow calculating required length for offsets. Count: {}. Tx: {}",
      [rootsDataLength.toString(), event.transaction.hash.toHex()]
    );
    return;
  }
  if (encodedData.length - structsBaseOffset < requiredLengthForOffsets) {
    log.error(
      "handleRootsAdded: Encoded data too short for root struct offsets. Base: {}, Required: {}, Available: {}. Tx: {}",
      [
        structsBaseOffset.toString(),
        requiredLengthForOffsets.toString(),
        (encodedData.length - structsBaseOffset).toString(),
        event.transaction.hash.toHex(),
      ]
    );
    return; // Cannot read all struct offsets
  }

  // Iterate through the array elements
  for (let i = 0; i < rootsDataLength; i++) {
    const structDataRelOffset = readUint256(
      encodedData,
      structsBaseOffset + i * 32
    ).toI32();
    const structDataAbsOffset = rootsDataOffset + structDataRelOffset; // Absolute offset from start of encodedData (after selector)

    // Decode struct { root: tuple { bytes }, rawSize: uint256 }
    if (
      structDataAbsOffset < 0 ||
      encodedData.length < structDataAbsOffset + 64
    ) {
      // Need 32 for root offset + 32 for rawSize
      log.error(
        "handleRootsAdded: Encoded data too short or invalid offset for root struct content. Struct Index: {}, Abs Offset: {}, Len: {}. Tx: {}",
        [
          i.toString(),
          structDataAbsOffset.toString(),
          encodedData.length.toString(),
          event.transaction.hash.toHex(),
        ]
      );
      continue; // Skip this root if data is too short or offset invalid
    }

    // Decode root tuple (bytes offset is at structDataAbsOffset + 0)
    const rootBytes = readBytes(encodedData, structDataAbsOffset); // readBytes handles inner offset/length

    // Decode rawSize (uint256 at structDataAbsOffset + 32)
    const rawSize = readUint256(encodedData, structDataAbsOffset + 32);

    // Get corresponding rootId from event params (assuming order matches)
    if (i >= rootIdsFromEvent.length) {
      log.error(
        "handleRootsAdded: Mismatch between decoded roots ({}) and event roots ({}). Tx: {}",
        [
          rootsDataLength.toString(),
          rootIdsFromEvent.length.toString(),
          event.transaction.hash.toHex(),
        ]
      );
      break; // Stop processing if lengths mismatch
    }
    const rootId = rootIdsFromEvent[i];

    parsedRootDetails.push({ rootId, rawSize, rootBytes });
    totalDataSizeAdded = totalDataSizeAdded.plus(rawSize);
  }

  // Verify lengths match
  if (parsedRootDetails.length != rootIdsFromEvent.length) {
    log.error(
      "handleRootsAdded: Final count mismatch after parsing. Decoded: {}, Event: {}. Tx: {}",
      [
        parsedRootDetails.length.toString(),
        rootIdsFromEvent.length.toString(),
        event.transaction.hash.toHex(),
      ]
    );
    // Decide how to handle mismatch. For now, log and continue with parsed details.
  }

  // --- 3. Create/Update Root Entities ---
  for (let i = 0; i < parsedRootDetails.length; i++) {
    const detail = parsedRootDetails[i];
    const rootId = detail.rootId;
    const rawSize = detail.rawSize;
    const rootBytes = detail.rootBytes;

    const rootEntityId = proofSetIdBytes.concatI32(rootId.toI32());
    let root = Root.load(Bytes.fromByteArray(rootEntityId));

    if (root == null) {
      root = new Root(Bytes.fromByteArray(rootEntityId));
      root.setId = setId;
      root.rootId = rootId;
      root.createdAt = event.block.timestamp;
      root.blockNumber = event.block.number;
      root.totalProofsSubmitted = BigInt.zero();
      root.totalPeriodsFaulted = BigInt.zero();
      root.lastProvenEpoch = BigInt.zero();
      root.lastProvenAt = BigInt.zero();
      root.lastFaultedEpoch = BigInt.zero();
      root.lastFaultedAt = BigInt.zero();
    }

    root.rawSize = rawSize;
    // Store hex representation of root bytes as CID for now
    root.cid = rootBytes.length > 0 ? rootBytes.toHex() : ""; // Use hex or empty string
    root.updatedAt = event.block.timestamp;
    root.removed = false;
    root.save();
  }

  // --- 4. Update Proof Set Statistics ---
  const proofSet = ProofSet.load(Bytes.fromByteArray(proofSetIdBytes));
  if (proofSet) {
    proofSet.totalRoots = proofSet.totalRoots.plus(
      BigInt.fromI32(parsedRootDetails.length) // Use count of successfully parsed roots
    );
    proofSet.totalDataSize = proofSet.totalDataSize.plus(totalDataSizeAdded); // Add parsed size
    proofSet.updatedAt = event.block.timestamp;
    proofSet.blockNumber = event.block.number;
    proofSet.save();
  } else {
    log.error("ProofSet not found for setId {} in handleRootsAdded. Tx: {}", [
      setId.toString(),
      event.transaction.hash.toHex(),
    ]);
  }

  // --- 5. Update Provider Statistics ---
  const providerAddress = event.transaction.from;
  let provider = Provider.load(providerAddress);
  if (provider == null) {
    provider = new Provider(providerAddress);
    provider.address = providerAddress;
    provider.totalDataSize = BigInt.zero(); // Initialize
    provider.totalFaultedPeriods = BigInt.zero();
    provider.createdAt = event.block.timestamp;
    provider.blockNumber = event.block.number;
  }
  provider.totalDataSize = provider.totalDataSize.plus(totalDataSizeAdded);
  provider.updatedAt = event.block.timestamp;
  provider.blockNumber = event.block.number; // Update block number on activity
  provider.save();
}

export function handleRootsRemoved(event: RootsRemovedEvent): void {
  const setId = event.params.setId;
  const rootIds = event.params.rootIds; // Array of BigInt
  const proofSetIdBytes = Bytes.fromBigInt(setId);

  // 1. Create Event Log
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const eventLog = new EventLog(eventId);
  eventLog.setId = setId;
  eventLog.name = "RootsRemoved";
  eventLog.address = event.address;
  eventLog.logIndex = event.logIndex;
  eventLog.blockNumber = event.block.number;
  eventLog.createdAt = event.block.timestamp;
  eventLog.transactionHash = event.transaction.hash;

  // Store rootIds array as a simple string in data field
  let rootIdStrings: string[] = [];
  for (let i = 0; i < rootIds.length; i++) {
    rootIdStrings.push(rootIds[i].toString());
  }
  eventLog.data = `{ "setId": "${setId.toString()}", "rootIds": [${rootIdStrings.join(",")}] }`;
  eventLog.save();

  // 2. Process Root Removals
  let totalDataSizeRemoved = BigInt.zero();
  let removedCount = 0;

  for (let i = 0; i < rootIds.length; i++) {
    const rootId = rootIds[i];
    const rootEntityId = proofSetIdBytes.concatI32(rootId.toI32());
    const rootEntityIdStr = Bytes.fromByteArray(rootEntityId).toHex(); // store.remove needs string ID

    const root = Root.load(Bytes.fromByteArray(rootEntityId));

    if (root != null) {
      totalDataSizeRemoved = totalDataSizeRemoved.plus(root.rawSize);
      root.removed = true;
      root.updatedAt = event.block.timestamp;
      root.blockNumber = event.block.number;
      root.save();
      removedCount++;
    } else {
      log.warning(
        "Root entity with id {} not found for removal in handleRootsRemoved. SetId: {}, Tx: {}",
        [rootEntityIdStr, setId.toString(), event.transaction.hash.toHex()]
      );
    }
  }

  // 3. Update Proof Set Statistics
  const proofSet = ProofSet.load(Bytes.fromByteArray(proofSetIdBytes));
  if (proofSet) {
    proofSet.totalRoots = proofSet.totalRoots.minus(
      BigInt.fromI32(removedCount)
    );
    // Ensure totalRoots doesn't go negative (though theoretically shouldn't happen if logic is correct)
    if (proofSet.totalRoots.lt(BigInt.zero())) {
      log.warning(
        "ProofSet {} totalRoots went negative after removal. Resetting to 0. Tx: {}",
        [proofSetIdBytes.toHex(), event.transaction.hash.toHex()]
      );
      proofSet.totalRoots = BigInt.zero();
    }

    proofSet.totalDataSize = proofSet.totalDataSize.minus(totalDataSizeRemoved);
    // Ensure totalDataSize doesn't go negative
    if (proofSet.totalDataSize.lt(BigInt.zero())) {
      log.warning(
        "ProofSet {} totalDataSize went negative after removal. Resetting to 0. Tx: {}",
        [proofSetIdBytes.toHex(), event.transaction.hash.toHex()]
      );
      proofSet.totalDataSize = BigInt.zero();
    }

    proofSet.updatedAt = event.block.timestamp;
    proofSet.blockNumber = event.block.number;
    proofSet.save();
  } else {
    // This case is less likely if roots existed, but possible in edge cases/reorgs
    log.error("ProofSet not found for setId {} in handleRootsRemoved. Tx: {}", [
      setId.toString(),
      event.transaction.hash.toHex(),
    ]);
  }

  // 4. Update Provider Statistics
  const providerAddress = event.transaction.from;
  const provider = Provider.load(providerAddress);
  if (provider) {
    provider.totalDataSize = provider.totalDataSize.minus(totalDataSizeRemoved);
    // Ensure totalDataSize doesn't go negative
    if (provider.totalDataSize.lt(BigInt.zero())) {
      log.warning(
        "Provider {} totalDataSize went negative after removal. Resetting to 0. Tx: {}",
        [providerAddress.toHex(), event.transaction.hash.toHex()]
      );
      provider.totalDataSize = BigInt.zero();
    }
    provider.updatedAt = event.block.timestamp;
    provider.blockNumber = event.block.number;
    provider.save();
  }
  // If provider doesn't exist, we don't need to do anything (can't subtract size)
}
