import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { newMockEvent } from "matchstick-as";
import {
  DataSetCreated,
  DataSetDeleted,
  DataSetEmpty,
  NextProvingPeriod,
  PiecesAdded,
  PiecesAddedV2,
  PossessionProven,
} from "../generated/PDPVerifier/PDPVerifier";

// Helper to generate unique transaction hash from a counter
export function generateTxHash(counter: i32): Bytes {
  const hexCounter = counter.toString(16).padStart(64, "0");
  return Bytes.fromHexString(`0x${hexCounter}`);
}

// Mocks the DataSetCreated event triggered by a direct createDataSet() call.
// Builds the transaction input for: createDataSet(address listenerAddr, bytes extraData)
// selector 0xbbae41cb — listenerAddr occupies input[16:36].
export function createDataSetCreatedEvent(
  setId: BigInt,
  provider: Address,
  contractAddress: Address,
  blockNumber: BigInt = BigInt.fromI32(1),
  timestamp: BigInt = BigInt.fromI32(1),
  txHash: Bytes = generateTxHash(1),
  logIndex: BigInt = BigInt.fromI32(0),
  listenerAddr: Address = Address.zero(),
): DataSetCreated {
  const DataSetCreatedEvent = changetype<DataSetCreated>(newMockEvent());

  DataSetCreatedEvent.parameters = [];

  const setIdParam = new ethereum.EventParam("setId", ethereum.Value.fromUnsignedBigInt(setId));
  const providerParam = new ethereum.EventParam("storageProvider", ethereum.Value.fromAddress(provider));

  DataSetCreatedEvent.parameters.push(setIdParam);
  DataSetCreatedEvent.parameters.push(providerParam);

  DataSetCreatedEvent.address = contractAddress;
  DataSetCreatedEvent.block.number = blockNumber;
  DataSetCreatedEvent.block.timestamp = timestamp;
  DataSetCreatedEvent.transaction.hash = txHash;
  DataSetCreatedEvent.logIndex = logIndex;
  DataSetCreatedEvent.transaction.from = provider;
  DataSetCreatedEvent.transaction.to = contractAddress;

  // Build createDataSet(address,bytes) calldata:
  //   [0..3]   selector  0xbbae41cb
  //   [4..35]  listenerAddr (address, left-padded to 32 bytes)
  //   [36..67] offset to extraData = 0x40 (64)
  //   [68..99] extraData length = 0
  const listenerHex = listenerAddr.toHexString().slice(2); // 40 hex chars, no 0x
  DataSetCreatedEvent.transaction.input = Bytes.fromHexString(
    "0xbbae41cb" +
      "000000000000000000000000" +
      listenerHex +
      "0000000000000000000000000000000000000000000000000000000000000040" +
      "0000000000000000000000000000000000000000000000000000000000000000",
  );

  return DataSetCreatedEvent;
}

// Mocks the DataSetCreated event triggered by an addPieces() call that creates a new dataset.
// Builds the transaction input for: addPieces(uint256 setId, address listenerAddr, Cids.Cid[], bytes)
// selector 0x9afd37f2 — listenerAddr occupies input[48:68].
export function createDataSetCreatedFromAddPiecesEvent(
  setId: BigInt,
  provider: Address,
  contractAddress: Address,
  listenerAddr: Address,
  blockNumber: BigInt = BigInt.fromI32(1),
  timestamp: BigInt = BigInt.fromI32(1),
  txHash: Bytes = generateTxHash(6),
  logIndex: BigInt = BigInt.fromI32(0),
): DataSetCreated {
  const DataSetCreatedEvent = changetype<DataSetCreated>(newMockEvent());

  DataSetCreatedEvent.parameters = [];

  const setIdParam = new ethereum.EventParam("setId", ethereum.Value.fromUnsignedBigInt(setId));
  const providerParam = new ethereum.EventParam("storageProvider", ethereum.Value.fromAddress(provider));

  DataSetCreatedEvent.parameters.push(setIdParam);
  DataSetCreatedEvent.parameters.push(providerParam);

  DataSetCreatedEvent.address = contractAddress;
  DataSetCreatedEvent.block.number = blockNumber;
  DataSetCreatedEvent.block.timestamp = timestamp;
  DataSetCreatedEvent.transaction.hash = txHash;
  DataSetCreatedEvent.logIndex = logIndex;
  DataSetCreatedEvent.transaction.from = provider;
  DataSetCreatedEvent.transaction.to = contractAddress;

  // Build addPieces(uint256,address,Cids.Cid[],bytes) calldata:
  //   [0..3]    selector  0x9afd37f2
  //   [4..35]   setId = 0 (caller passes 0 to signal "create new dataset"; the
  //             contract assigns the real setId which is reflected in event.params)
  //   [36..67]  listenerAddr (address, left-padded to 32 bytes)
  //   [68..99]  offset to pieceData = 0x80 (128)
  //   [100..131] offset to extraData = 0xa0 (160)
  //   [132..163] pieceData length = 0
  //   [164..195] extraData length = 0
  const listenerHex = listenerAddr.toHexString().slice(2); // 40 hex chars
  DataSetCreatedEvent.transaction.input = Bytes.fromHexString(
    "0x9afd37f2" +
      "0000000000000000000000000000000000000000000000000000000000000000" +
      "000000000000000000000000" +
      listenerHex +
      "0000000000000000000000000000000000000000000000000000000000000080" +
      "00000000000000000000000000000000000000000000000000000000000000a0" +
      "0000000000000000000000000000000000000000000000000000000000000000" +
      "0000000000000000000000000000000000000000000000000000000000000000",
  );

  return DataSetCreatedEvent;
}

export function createRootsAddedEvent(
  setId: BigInt,
  pieceIds: BigInt[],
  sender: Address,
  contractAddress: Address,
): PiecesAdded {
  const rootsAddedEvent = changetype<PiecesAdded>(newMockEvent());

  rootsAddedEvent.parameters = [];
  rootsAddedEvent.address = contractAddress;
  rootsAddedEvent.transaction.from = sender;
  rootsAddedEvent.transaction.to = contractAddress;

  const setIdParam = new ethereum.EventParam("setId", ethereum.Value.fromUnsignedBigInt(setId));
  const rootIdsParam = new ethereum.EventParam("pieceIds", ethereum.Value.fromUnsignedBigIntArray(pieceIds));

  const pieceCids: Array<ethereum.Tuple> = [];
  for (let i = 0; i < pieceIds.length; i++) {
    const cidTuple = new ethereum.Tuple();
    const cidData = Bytes.fromHexString(
      "0x01559120258ff7f7021387dcea7164b7d1c4a98bd6f8d3c187e3114795efa391df307c8aa9d5d5cbac03",
    );
    cidTuple.push(ethereum.Value.fromBytes(cidData));
    pieceCids.push(cidTuple);
  }

  const pieceCidsParam = new ethereum.EventParam("pieceCids", ethereum.Value.fromTupleArray(pieceCids));

  rootsAddedEvent.parameters.push(setIdParam);
  rootsAddedEvent.parameters.push(rootIdsParam);
  rootsAddedEvent.parameters.push(pieceCidsParam);

  rootsAddedEvent.block.number = BigInt.fromI32(1);
  rootsAddedEvent.block.timestamp = BigInt.fromI32(1);

  return rootsAddedEvent;
}

// header/root packing of the same CID used by createRootsAddedEvent
// (0x01559120258ff7f7021387dcea7164b7d1c4a98bd6f8d3c187e3114795efa391df307c8aa9d5d5cbac03):
// the header is right-aligned/zero-padded to 32 bytes, the trailing 32 bytes are the digest ("root").
export const PACKED_CID_HEADER = "0x0000000000000000000000000000000000000000000001559120258ff7f70213";
export const PACKED_CID_ROOT = "0x87dcea7164b7d1c4a98bd6f8d3c187e3114795efa391df307c8aa9d5d5cbac03";

export function createPiecesAddedV2Event(
  setId: BigInt,
  firstPieceId: BigInt,
  pieceCount: i32,
  sender: Address,
  contractAddress: Address,
  blockNumber: BigInt = BigInt.fromI32(1),
  timestamp: BigInt = BigInt.fromI32(1),
  txHash: Bytes = generateTxHash(1),
  logIndex: BigInt = BigInt.fromI32(0),
): PiecesAddedV2 {
  const piecesAddedV2Event = changetype<PiecesAddedV2>(newMockEvent());

  piecesAddedV2Event.parameters = [];
  piecesAddedV2Event.address = contractAddress;
  piecesAddedV2Event.transaction.from = sender;
  piecesAddedV2Event.transaction.to = contractAddress;

  const setIdParam = new ethereum.EventParam("setId", ethereum.Value.fromUnsignedBigInt(setId));
  const firstPieceIdParam = new ethereum.EventParam(
    "firstPieceId",
    ethereum.Value.fromUnsignedBigInt(firstPieceId),
  );

  const pieceCids: Array<ethereum.Tuple> = [];
  for (let i = 0; i < pieceCount; i++) {
    const packedCidTuple = new ethereum.Tuple();
    packedCidTuple.push(ethereum.Value.fromFixedBytes(Bytes.fromHexString(PACKED_CID_HEADER)));
    packedCidTuple.push(ethereum.Value.fromFixedBytes(Bytes.fromHexString(PACKED_CID_ROOT)));
    pieceCids.push(packedCidTuple);
  }

  const pieceCidsParam = new ethereum.EventParam("pieceCids", ethereum.Value.fromTupleArray(pieceCids));

  piecesAddedV2Event.parameters.push(setIdParam);
  piecesAddedV2Event.parameters.push(firstPieceIdParam);
  piecesAddedV2Event.parameters.push(pieceCidsParam);

  piecesAddedV2Event.block.number = blockNumber;
  piecesAddedV2Event.block.timestamp = timestamp;
  piecesAddedV2Event.transaction.hash = txHash;
  piecesAddedV2Event.logIndex = logIndex;

  return piecesAddedV2Event;
}

export function createNextProvingPeriodEvent(
  setId: BigInt,
  challengeEpoch: BigInt,
  leafCount: BigInt,
  contractAddress: Address,
  blockNumber: BigInt = BigInt.fromI32(1),
  timestamp: BigInt = BigInt.fromI32(1),
  txHash: Bytes = generateTxHash(2),
  logIndex: BigInt = BigInt.fromI32(0),
): NextProvingPeriod {
  const nextProvingPeriodEvent = changetype<NextProvingPeriod>(newMockEvent());

  nextProvingPeriodEvent.parameters = [];

  const setIdParam = new ethereum.EventParam("setId", ethereum.Value.fromUnsignedBigInt(setId));
  const challengeEpochParam = new ethereum.EventParam(
    "challengeEpoch",
    ethereum.Value.fromUnsignedBigInt(challengeEpoch),
  );
  const leafCountParam = new ethereum.EventParam("leafCount", ethereum.Value.fromUnsignedBigInt(leafCount));

  nextProvingPeriodEvent.parameters.push(setIdParam);
  nextProvingPeriodEvent.parameters.push(challengeEpochParam);
  nextProvingPeriodEvent.parameters.push(leafCountParam);

  nextProvingPeriodEvent.address = contractAddress;
  nextProvingPeriodEvent.block.number = blockNumber;
  nextProvingPeriodEvent.block.timestamp = timestamp;
  nextProvingPeriodEvent.transaction.hash = txHash;
  nextProvingPeriodEvent.logIndex = logIndex;

  return nextProvingPeriodEvent;
}

export function createPossessionProvenEvent(
  setId: BigInt,
  pieceIds: BigInt[],
  offsets: BigInt[],
  contractAddress: Address,
  blockNumber: BigInt = BigInt.fromI32(1),
  timestamp: BigInt = BigInt.fromI32(1),
  txHash: Bytes = generateTxHash(3),
  logIndex: BigInt = BigInt.fromI32(0),
): PossessionProven {
  if (pieceIds.length !== offsets.length) {
    throw new Error(
      `createPossessionProvenEvent: pieceIds.length (${pieceIds.length}) must equal offsets.length (${offsets.length})`,
    );
  }

  const possessionProvenEvent = changetype<PossessionProven>(newMockEvent());

  possessionProvenEvent.parameters = [];

  const setIdParam = new ethereum.EventParam("setId", ethereum.Value.fromUnsignedBigInt(setId));

  const challenges: Array<ethereum.Tuple> = [];
  for (let i = 0; i < pieceIds.length; i++) {
    const challenge = new ethereum.Tuple();
    challenge.push(ethereum.Value.fromUnsignedBigInt(pieceIds[i]));
    challenge.push(ethereum.Value.fromUnsignedBigInt(offsets[i]));
    challenges.push(challenge);
  }

  const challengesParam = new ethereum.EventParam("challenges", ethereum.Value.fromTupleArray(challenges));

  possessionProvenEvent.parameters.push(setIdParam);
  possessionProvenEvent.parameters.push(challengesParam);

  possessionProvenEvent.address = contractAddress;
  possessionProvenEvent.block.number = blockNumber;
  possessionProvenEvent.block.timestamp = timestamp;
  possessionProvenEvent.transaction.hash = txHash;
  possessionProvenEvent.logIndex = logIndex;

  return possessionProvenEvent;
}

export function createDataSetDeletedEvent(
  setId: BigInt,
  deletedLeafCount: BigInt,
  contractAddress: Address,
  blockNumber: BigInt = BigInt.fromI32(1),
  timestamp: BigInt = BigInt.fromI32(1),
  txHash: Bytes = generateTxHash(4),
  logIndex: BigInt = BigInt.fromI32(0),
): DataSetDeleted {
  const dataSetDeletedEvent = changetype<DataSetDeleted>(newMockEvent());

  dataSetDeletedEvent.parameters = [];

  const setIdParam = new ethereum.EventParam("setId", ethereum.Value.fromUnsignedBigInt(setId));
  const deletedLeafCountParam = new ethereum.EventParam(
    "deletedLeafCount",
    ethereum.Value.fromUnsignedBigInt(deletedLeafCount),
  );

  dataSetDeletedEvent.parameters.push(setIdParam);
  dataSetDeletedEvent.parameters.push(deletedLeafCountParam);

  dataSetDeletedEvent.address = contractAddress;
  dataSetDeletedEvent.block.number = blockNumber;
  dataSetDeletedEvent.block.timestamp = timestamp;
  dataSetDeletedEvent.transaction.hash = txHash;
  dataSetDeletedEvent.logIndex = logIndex;
  dataSetDeletedEvent.transaction.from = Address.fromString("0xa16081f360e3847006db660bae1c6d1b2e17ec2a");
  dataSetDeletedEvent.transaction.to = contractAddress;

  return dataSetDeletedEvent;
}

export function createDataSetEmptyEvent(
  setId: BigInt,
  contractAddress: Address,
  blockNumber: BigInt = BigInt.fromI32(1),
  timestamp: BigInt = BigInt.fromI32(1),
  txHash: Bytes = generateTxHash(5),
  logIndex: BigInt = BigInt.fromI32(0),
): DataSetEmpty {
  const dataSetEmptyEvent = changetype<DataSetEmpty>(newMockEvent());

  dataSetEmptyEvent.parameters = [];

  const setIdParam = new ethereum.EventParam("setId", ethereum.Value.fromUnsignedBigInt(setId));

  dataSetEmptyEvent.parameters.push(setIdParam);

  dataSetEmptyEvent.address = contractAddress;
  dataSetEmptyEvent.block.number = blockNumber;
  dataSetEmptyEvent.block.timestamp = timestamp;
  dataSetEmptyEvent.transaction.hash = txHash;
  dataSetEmptyEvent.logIndex = logIndex;
  dataSetEmptyEvent.transaction.from = Address.fromString("0xa16081f360e3847006db660bae1c6d1b2e17ec2a");
  dataSetEmptyEvent.transaction.to = contractAddress;

  return dataSetEmptyEvent;
}
