import { newMockEvent } from "matchstick-as";
import {
  ethereum,
  BigInt,
  Address,
  Bytes,
  crypto,
  log,
} from "@graphprotocol/graph-ts";
import {
  ProofSetCreated,
  RootsAdded,
} from "../generated/PDPVerifier/PDPVerifier";

// Mocks the ProofSetCreated event
// event ProofSetCreated(uint256 indexed setId, address indexed provider, bytes32 root);
export function createProofSetCreatedEvent(
  setId: BigInt,
  provider: Address,
  root: Bytes, // Although root is part of the event, handleProofSetCreated might not use it directly
  contractAddress: Address,
  blockNumber: BigInt = BigInt.fromI32(1),
  timestamp: BigInt = BigInt.fromI32(1)
): ProofSetCreated {
  let proofSetCreatedEvent = changetype<ProofSetCreated>(newMockEvent());

  proofSetCreatedEvent.parameters = new Array();

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

  proofSetCreatedEvent.parameters.push(setIdParam);
  proofSetCreatedEvent.parameters.push(providerParam);
  proofSetCreatedEvent.parameters.push(rootParam);

  proofSetCreatedEvent.address = contractAddress;
  proofSetCreatedEvent.block.number = blockNumber;
  proofSetCreatedEvent.block.timestamp = timestamp;

  // Transaction input is not strictly needed if the handler only uses event.params
  // proofSetCreatedEvent.transaction.input = Bytes.fromI32(0);

  return proofSetCreatedEvent;
}

export function createRootsAddedEvent(
  setId: BigInt,
  rootIds: BigInt[],
  sender: Address,
  contractAddress: Address
): RootsAdded {
  let rootsAddedEvent = changetype<RootsAdded>(newMockEvent());

  rootsAddedEvent.parameters = new Array();
  rootsAddedEvent.address = contractAddress;
  rootsAddedEvent.transaction.from = sender;
  rootsAddedEvent.transaction.to = contractAddress;

  let setIdParam = new ethereum.EventParam(
    "setId",
    ethereum.Value.fromUnsignedBigInt(setId)
  );
  let rootIdsParam = new ethereum.EventParam(
    "rootIds",
    ethereum.Value.fromUnsignedBigIntArray(rootIds)
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
