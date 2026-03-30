import { newMockEvent } from "matchstick-as";
import { ethereum, BigInt, Address, Bytes } from "@graphprotocol/graph-ts";
import {
  DataSetCreated,
  PiecesAdded,
  NextProvingPeriod,
  PossessionProven,
  DataSetDeleted,
  DataSetEmpty,
} from "../generated/PDPVerifier/PDPVerifier";

// Helper to generate unique transaction hash from a counter
export function generateTxHash(counter: i32): Bytes {
  const hexCounter = counter.toString(16).padStart(64, "0");
  return Bytes.fromHexString("0x" + hexCounter);
}

// Mocks the DataSetCreated event
// event DataSetCreated(uint256 indexed setId, address indexed provider, bytes32 root);
export function createDataSetCreatedEvent(
  setId: BigInt,
  provider: Address,
  root: Bytes, // Although root is part of the event, handleDataSetCreated might not use it directly
  contractAddress: Address,
  blockNumber: BigInt = BigInt.fromI32(1),
  timestamp: BigInt = BigInt.fromI32(1),
  txHash: Bytes = generateTxHash(1),
  logIndex: BigInt = BigInt.fromI32(0)
): DataSetCreated {
  let DataSetCreatedEvent = changetype<DataSetCreated>(newMockEvent());

  DataSetCreatedEvent.parameters = new Array();

  let setIdParam = new ethereum.EventParam(
    "setId",
    ethereum.Value.fromUnsignedBigInt(setId)
  );
  let providerParam = new ethereum.EventParam(
    "provider",
    ethereum.Value.fromAddress(provider)
  );
  let rootParam = new ethereum.EventParam(
    "root",
    ethereum.Value.fromFixedBytes(root)
  );

  DataSetCreatedEvent.parameters.push(setIdParam);
  DataSetCreatedEvent.parameters.push(providerParam);
  DataSetCreatedEvent.parameters.push(rootParam);

  DataSetCreatedEvent.address = contractAddress;
  DataSetCreatedEvent.block.number = blockNumber;
  DataSetCreatedEvent.block.timestamp = timestamp;
  DataSetCreatedEvent.transaction.hash = txHash;
  DataSetCreatedEvent.logIndex = logIndex;

  // Transaction input is not strictly needed if the handler only uses event.params
  // DataSetCreatedEvent.transaction.input = Bytes.fromI32(0);

  return DataSetCreatedEvent;
}

export function createRootsAddedEvent(
  setId: BigInt,
  pieceIds: BigInt[],
  sender: Address,
  contractAddress: Address
): PiecesAdded {
  let rootsAddedEvent = changetype<PiecesAdded>(newMockEvent());

  rootsAddedEvent.parameters = new Array();
  rootsAddedEvent.address = contractAddress;
  rootsAddedEvent.transaction.from = sender;
  rootsAddedEvent.transaction.to = contractAddress;

  let setIdParam = new ethereum.EventParam(
    "setId",
    ethereum.Value.fromUnsignedBigInt(setId)
  );
  let rootIdsParam = new ethereum.EventParam(
    "pieceIds",
    ethereum.Value.fromUnsignedBigIntArray(pieceIds)
  );

  let pieceCids: Array<ethereum.Tuple> = [];
  for (let i = 0; i < pieceIds.length; i++) {
    let cidTuple = new ethereum.Tuple();
    let cidData = Bytes.fromHexString(
      "0x01559120258ff7f7021387dcea7164b7d1c4a98bd6f8d3c187e3114795efa391df307c8aa9d5d5cbac03"
    );
    cidTuple.push(ethereum.Value.fromBytes(cidData));
    pieceCids.push(cidTuple);
  }

  let pieceCidsParam = new ethereum.EventParam(
    "pieceCids",
    ethereum.Value.fromTupleArray(pieceCids)
  );

  rootsAddedEvent.parameters.push(setIdParam);
  rootsAddedEvent.parameters.push(rootIdsParam);
  rootsAddedEvent.parameters.push(pieceCidsParam);

  let txInputHex =
    "0x9afd37f20000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002a01559120258ff7f7021387dcea7164b7d1c4a98bd6f8d3c187e3114795efa391df307c8aa9d5d5cbac030000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002a05f13cbf0c320f1092664967af5de13e4abe964d4f755c0d4cffe18a146f395030000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000002200000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000b69706673526f6f744349440000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000003b626166796265696537696d32766e766870347a726d6778776c6b336d6133736f736f6e743765367776726f63336134756261707a7a7a3368796a75000000000000000000000000000000000000000000000000000000000000000000000000411b4c7e389fe7383d20d251599c194c9ddb3e71d79c2c1b44fe15b0f505aea92e525239a7e91647c64370054fe8a779486342fafb8971a7eb69101c97368c4bf61b00000000000000000000000000000000000000000000000000000000000000";
  let txInput = Bytes.fromHexString(txInputHex);
  rootsAddedEvent.transaction.input = txInput;

  rootsAddedEvent.block.number = BigInt.fromI32(1);
  rootsAddedEvent.block.timestamp = BigInt.fromI32(1);

  return rootsAddedEvent;
}

export function createNextProvingPeriodEvent(
  setId: BigInt,
  challengeEpoch: BigInt,
  leafCount: BigInt,
  contractAddress: Address,
  blockNumber: BigInt = BigInt.fromI32(1),
  timestamp: BigInt = BigInt.fromI32(1),
  txHash: Bytes = generateTxHash(2),
  logIndex: BigInt = BigInt.fromI32(0)
): NextProvingPeriod {
  let nextProvingPeriodEvent = changetype<NextProvingPeriod>(newMockEvent());

  nextProvingPeriodEvent.parameters = new Array();

  let setIdParam = new ethereum.EventParam(
    "setId",
    ethereum.Value.fromUnsignedBigInt(setId)
  );
  let challengeEpochParam = new ethereum.EventParam(
    "challengeEpoch",
    ethereum.Value.fromUnsignedBigInt(challengeEpoch)
  );
  let leafCountParam = new ethereum.EventParam(
    "leafCount",
    ethereum.Value.fromUnsignedBigInt(leafCount)
  );

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
  logIndex: BigInt = BigInt.fromI32(0)
): PossessionProven {
  if (pieceIds.length !== offsets.length) {
    throw new Error(
      `createPossessionProvenEvent: pieceIds.length (${pieceIds.length}) must equal offsets.length (${offsets.length})`
    );
  }

  let possessionProvenEvent = changetype<PossessionProven>(newMockEvent());

  possessionProvenEvent.parameters = new Array();

  let setIdParam = new ethereum.EventParam(
    "setId",
    ethereum.Value.fromUnsignedBigInt(setId)
  );

  let challenges: Array<ethereum.Tuple> = [];
  for (let i = 0; i < pieceIds.length; i++) {
    let challenge = new ethereum.Tuple();
    challenge.push(ethereum.Value.fromUnsignedBigInt(pieceIds[i]));
    challenge.push(ethereum.Value.fromUnsignedBigInt(offsets[i]));
    challenges.push(challenge);
  }

  let challengesParam = new ethereum.EventParam(
    "challenges",
    ethereum.Value.fromTupleArray(challenges)
  );

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
  logIndex: BigInt = BigInt.fromI32(0)
): DataSetDeleted {
  let dataSetDeletedEvent = changetype<DataSetDeleted>(newMockEvent());

  dataSetDeletedEvent.parameters = new Array();

  let setIdParam = new ethereum.EventParam(
    "setId",
    ethereum.Value.fromUnsignedBigInt(setId)
  );
  let deletedLeafCountParam = new ethereum.EventParam(
    "deletedLeafCount",
    ethereum.Value.fromUnsignedBigInt(deletedLeafCount)
  );

  dataSetDeletedEvent.parameters.push(setIdParam);
  dataSetDeletedEvent.parameters.push(deletedLeafCountParam);

  dataSetDeletedEvent.address = contractAddress;
  dataSetDeletedEvent.block.number = blockNumber;
  dataSetDeletedEvent.block.timestamp = timestamp;
  dataSetDeletedEvent.transaction.hash = txHash;
  dataSetDeletedEvent.logIndex = logIndex;
  dataSetDeletedEvent.transaction.from = Address.fromString(
    "0xa16081f360e3847006db660bae1c6d1b2e17ec2a"
  );
  dataSetDeletedEvent.transaction.to = contractAddress;

  return dataSetDeletedEvent;
}

export function createDataSetEmptyEvent(
  setId: BigInt,
  contractAddress: Address,
  blockNumber: BigInt = BigInt.fromI32(1),
  timestamp: BigInt = BigInt.fromI32(1),
  txHash: Bytes = generateTxHash(5),
  logIndex: BigInt = BigInt.fromI32(0)
): DataSetEmpty {
  let dataSetEmptyEvent = changetype<DataSetEmpty>(newMockEvent());

  dataSetEmptyEvent.parameters = new Array();

  let setIdParam = new ethereum.EventParam(
    "setId",
    ethereum.Value.fromUnsignedBigInt(setId)
  );

  dataSetEmptyEvent.parameters.push(setIdParam);

  dataSetEmptyEvent.address = contractAddress;
  dataSetEmptyEvent.block.number = blockNumber;
  dataSetEmptyEvent.block.timestamp = timestamp;
  dataSetEmptyEvent.transaction.hash = txHash;
  dataSetEmptyEvent.logIndex = logIndex;
  dataSetEmptyEvent.transaction.from = Address.fromString(
    "0xa16081f360e3847006db660bae1c6d1b2e17ec2a"
  );
  dataSetEmptyEvent.transaction.to = contractAddress;

  return dataSetEmptyEvent;
}
