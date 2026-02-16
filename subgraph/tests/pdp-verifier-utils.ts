import { newMockEvent } from "matchstick-as";
import { ethereum, BigInt, Address, Bytes } from "@graphprotocol/graph-ts";
import {
  DataSetCreated,
  PiecesAdded,
  NextProvingPeriod,
  PossessionProven,
} from "../generated/PDPVerifier/PDPVerifier";

// Mocks the DataSetCreated event
// event DataSetCreated(uint256 indexed setId, address indexed provider, bytes32 root);
export function createDataSetCreatedEvent(
  setId: BigInt,
  provider: Address,
  root: Bytes, // Although root is part of the event, handleDataSetCreated might not use it directly
  contractAddress: Address,
  blockNumber: BigInt = BigInt.fromI32(1),
  timestamp: BigInt = BigInt.fromI32(1)
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
  rootsAddedEvent.parameters.push(setIdParam);
  rootsAddedEvent.parameters.push(rootIdsParam);

  let txInputHex =
    "0x11c0ee4a00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000fe000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000270181e20392202015ef4cc07f475ed2ee3ad23cfbb7fbffd6707bf8207743d6e4a4640b3742e709000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
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
  timestamp: BigInt = BigInt.fromI32(1)
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

  return nextProvingPeriodEvent;
}

export function createPossessionProvenEvent(
  setId: BigInt,
  pieceIds: BigInt[],
  offsets: BigInt[],
  contractAddress: Address,
  blockNumber: BigInt = BigInt.fromI32(1),
  timestamp: BigInt = BigInt.fromI32(1)
): PossessionProven {
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

  return possessionProvenEvent;
}
