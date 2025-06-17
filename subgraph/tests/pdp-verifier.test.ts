import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll,
} from "matchstick-as/assembly/index";
import { BigInt, Address, Bytes, ByteArray } from "@graphprotocol/graph-ts";
import { Root, ProofSet, Provider, EventLog } from "../generated/schema";
import { handleRootsAdded, handleProofSetCreated } from "../src/pdp-verifier";
import {
  createRootsAddedEvent,
  createProofSetCreatedEvent,
} from "./pdp-verifier-utils";

// Define constants for test data
const SET_ID = BigInt.fromI32(0);
const ROOT_ID_1 = BigInt.fromI32(101);
const RAW_SIZE_1 = BigInt.fromI32(1040384);
// CIDs as strings
const ROOT_CID_1_STR =
  "0x0181e20392202015ef4cc07f475ed2ee3ad23cfbb7fbffd6707bf8207743d6e4a4640b3742e709";
const SENDER_ADDRESS = Address.fromString(
  "0xa16081f360e3847006db660bae1c6d1b2e17ec2a"
);
const LISTENER_ADDRESS = Address.fromString(
  "0x0000000000000000000000000000000000000001"
);
const CONTRACT_ADDRESS = Address.fromString(
  "0xb16081f360e3847006db660bae1c6d1b2e17ec2b"
);
const PROOF_SET_ID_BYTES = Bytes.fromBigInt(SET_ID);

// Helper function to create Root entity ID
function createRootEntityId(proofSetIdBytes: Bytes, rootId: BigInt): Bytes {
  // .concatI32 returns ByteArray, which needs to be converted back to Bytes
  return Bytes.fromByteArray(proofSetIdBytes.concatI32(rootId.toI32()));
}

// Helper to convert string to Bytes and pad to 32 bytes
function stringToBytes32(str: string): Bytes {
  let utf8Bytes = Bytes.fromUTF8(str);
  let paddedBytes = new ByteArray(32); // Create a 32-byte array, initialized to zeros

  // Copy bytes from utf8Bytes, ensuring we don't exceed 32 bytes
  for (let i = 0; i < utf8Bytes.length && i < 32; i++) {
    paddedBytes[i] = utf8Bytes[i];
  }
  return Bytes.fromByteArray(paddedBytes);
}

describe("handleRootsAdded Tests", () => {
  beforeAll(() => {
    // 1. Create the necessary ProofSet first
    let mockProofSetCreatedEvent = createProofSetCreatedEvent(
      SET_ID,
      SENDER_ADDRESS,
      Bytes.fromI32(123), // Dummy root, as it's required by the function but not used by the handler here
      CONTRACT_ADDRESS,
      BigInt.fromI32(50), // Match block number for consistency
      BigInt.fromI32(1678886400) // Match timestamp for consistency
    );
    handleProofSetCreated(mockProofSetCreatedEvent);

    // 2. Create and handle the RootsAdded event
    let rootIds = [ROOT_ID_1];
    let rootsAddedEvent = createRootsAddedEvent(
      SET_ID,
      rootIds,
      SENDER_ADDRESS,
      CONTRACT_ADDRESS
    );

    // Set block/tx details on the mock event if needed by handler
    rootsAddedEvent.block.timestamp = BigInt.fromI32(100); // Example timestamp
    rootsAddedEvent.block.number = BigInt.fromI32(50); // Example block number
    rootsAddedEvent.logIndex = BigInt.fromI32(1); // Example log index
    rootsAddedEvent.transaction.hash = Bytes.fromHexString(
      "0x" + "c".repeat(64)
    );

    handleRootsAdded(rootsAddedEvent);
  });

  afterAll(() => {
    clearStore();
  });

  test("Entities created and stored correctly", () => {
    // Assert counts
    assert.entityCount("ProofSet", 1);
    assert.entityCount("Root", 1); // One root was added
    assert.entityCount("Provider", 1);
    assert.entityCount("EventLog", 2); // RootsAdded creates one event log

    // --- Assert ProofSet fields ---
    let proofSetId = PROOF_SET_ID_BYTES.toHex();
    assert.fieldEquals("ProofSet", proofSetId, "setId", SET_ID.toString());
    assert.fieldEquals("ProofSet", proofSetId, "totalRoots", "1"); // Initially 0, added 1
    let expectedTotalSize = RAW_SIZE_1.toString();
    assert.fieldEquals(
      "ProofSet",
      proofSetId,
      "totalDataSize",
      expectedTotalSize
    );
    assert.fieldEquals("ProofSet", proofSetId, "updatedAt", "100");
    assert.fieldEquals("ProofSet", proofSetId, "blockNumber", "50");

    // --- Assert Root fields ---
    let rootEntityId1 = createRootEntityId(
      Bytes.fromByteArray(PROOF_SET_ID_BYTES),
      ROOT_ID_1
    ).toHex();
    assert.fieldEquals("Root", rootEntityId1, "rootId", ROOT_ID_1.toString());
    assert.fieldEquals("Root", rootEntityId1, "setId", SET_ID.toString());
    assert.fieldEquals("Root", rootEntityId1, "cid", ROOT_CID_1_STR);
    assert.fieldEquals("Root", rootEntityId1, "rawSize", RAW_SIZE_1.toString());
    // assert.fieldEquals("Root", rootEntityId1, "createdAt", "100");
    assert.fieldEquals("Root", rootEntityId1, "blockNumber", "50");

    // --- Assert Provider fields ---
    let providerId = SENDER_ADDRESS.toHex();
    assert.fieldEquals(
      "Provider",
      providerId,
      "totalDataSize",
      expectedTotalSize
    );
    assert.fieldEquals("Provider", providerId, "updatedAt", "100");
    assert.fieldEquals("Provider", providerId, "blockNumber", "50");
    // Assuming provider was newly created by this event
    // assert.fieldEquals("Provider", providerId, "createdAt", "100");

    // --- Assert EventLog fields ---
    // Construct expected event ID: txHash + logIndex
    let eventId = Bytes.fromHexString("0x" + "c".repeat(64))
      .concatI32(BigInt.fromI32(1).toI32())
      .toHex();
    assert.fieldEquals("EventLog", eventId, "name", "RootsAdded");
    assert.fieldEquals("EventLog", eventId, "setId", SET_ID.toString());
    assert.fieldEquals(
      "EventLog",
      eventId,
      "transactionHash",
      "0x" + "c".repeat(64)
    );
    assert.fieldEquals("EventLog", eventId, "blockNumber", "50");
    assert.fieldEquals("EventLog", eventId, "logIndex", "1");
    assert.fieldEquals("EventLog", eventId, "createdAt", "100");
    // Check data field (simple representation)
    let expectedData = `{ "setId": "${SET_ID.toString()}", "rootIds": [${ROOT_ID_1.toString()}] }`;
    assert.fieldEquals("EventLog", eventId, "data", expectedData);
  });
});
