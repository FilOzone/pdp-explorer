import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { afterAll, assert, beforeAll, clearStore, describe, test } from "matchstick-as/assembly/index";
import { getRootEntityId, handleDataSetCreated, handlePiecesAdded, handlePiecesAddedV2 } from "../src/pdp-verifier";
import {
  createDataSetCreatedEvent,
  createDataSetCreatedFromAddPiecesEvent,
  createPiecesAddedV2Event,
  createRootsAddedEvent,
} from "./pdp-verifier-utils";

// Define constants for test data
const SET_ID = BigInt.fromI32(1);
const ADD_PIECES_SET_ID = BigInt.fromI32(2);
const ADD_PIECES_LISTENER = Address.fromString("0x1111111111111111111111111111111111111111");
const ADD_PIECES_TX_HASH = Bytes.fromHexString(`0x${"d".repeat(64)}`);
const UNKNOWN_SELECTOR_SET_ID = BigInt.fromI32(3);
const UNKNOWN_SELECTOR_TX_HASH = Bytes.fromHexString(`0x${"e".repeat(64)}`);
const ROOT_ID_1 = BigInt.fromI32(101);
const RAW_SIZE_1 = BigInt.fromI32(10486897);
// CIDs as strings
const ROOT_CID_1_STR = "0x01559120258ff7f7021387dcea7164b7d1c4a98bd6f8d3c187e3114795efa391df307c8aa9d5d5cbac03";
const SENDER_ADDRESS = Address.fromString("0xa16081f360e3847006db660bae1c6d1b2e17ec2a");
const LISTENER_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000001");
const CONTRACT_ADDRESS = Address.fromString("0xb16081f360e3847006db660bae1c6d1b2e17ec2b");
const PROOF_SET_ID_BYTES = Bytes.fromBigInt(SET_ID);
const SET_ID_V2 = BigInt.fromI32(4);
const FIRST_PIECE_ID_V2 = BigInt.fromI32(200);
const PIECES_ADDED_V2_TX_HASH = Bytes.fromHexString(`0x${"f".repeat(64)}`);
const SET_ID_BATCH = BigInt.fromI32(5);
const FIRST_PIECE_ID_BATCH = BigInt.fromI32(300);
const PIECE_COUNT = 3;

describe("handlePiecesAdded Tests", () => {
  beforeAll(() => {
    // 1. Create the necessary DataSet first (via createDataSet call)
    const mockDataSetCreatedEvent = createDataSetCreatedEvent(
      SET_ID,
      SENDER_ADDRESS,
      CONTRACT_ADDRESS,
      BigInt.fromI32(50),
      BigInt.fromI32(1678886400),
      Bytes.fromHexString(`0x${"a".repeat(64)}`),
      BigInt.fromI32(0),
      LISTENER_ADDRESS,
    );
    handleDataSetCreated(mockDataSetCreatedEvent);

    // 2. Create and handle the piecesAdded event
    const pieceIds = [ROOT_ID_1];
    const rootsAddedEvent = createRootsAddedEvent(SET_ID, pieceIds, SENDER_ADDRESS, CONTRACT_ADDRESS);

    // Set block/tx details on the mock event if needed by handler
    rootsAddedEvent.block.timestamp = BigInt.fromI32(100); // Example timestamp
    rootsAddedEvent.block.number = BigInt.fromI32(50); // Example block number
    rootsAddedEvent.logIndex = BigInt.fromI32(1); // Example log index
    rootsAddedEvent.transaction.hash = Bytes.fromHexString(`0x${"c".repeat(64)}`);

    handlePiecesAdded(rootsAddedEvent);
  });

  afterAll(() => {
    clearStore();
  });

  test("Entities created and stored correctly", () => {
    // Assert counts
    assert.entityCount("DataSet", 1);
    assert.entityCount("Root", 1); // One root was added
    assert.entityCount("Provider", 1);
    assert.entityCount("EventLog", 2); // piecesAdded creates one event log

    // --- Assert DataSet fields ---
    const dataSetId = PROOF_SET_ID_BYTES.toHex();
    assert.fieldEquals("DataSet", dataSetId, "setId", SET_ID.toString());
    assert.fieldEquals("DataSet", dataSetId, "listener", LISTENER_ADDRESS.toHexString());
    assert.fieldEquals("DataSet", dataSetId, "totalRoots", "1"); // Initially 0, added 1
    const expectedTotalSize = RAW_SIZE_1.toString();
    assert.fieldEquals("DataSet", dataSetId, "totalDataSize", expectedTotalSize);
    assert.fieldEquals("DataSet", dataSetId, "updatedAt", "100");
    assert.fieldEquals("DataSet", dataSetId, "blockNumber", "50");

    // --- Assert Root fields ---
    const rootEntityId1 = getRootEntityId(SET_ID, ROOT_ID_1).toHex();
    assert.fieldEquals("Root", rootEntityId1, "rootId", ROOT_ID_1.toString());
    assert.fieldEquals("Root", rootEntityId1, "setId", SET_ID.toString());
    assert.fieldEquals("Root", rootEntityId1, "cid", ROOT_CID_1_STR);
    assert.fieldEquals("Root", rootEntityId1, "rawSize", RAW_SIZE_1.toString());
    // assert.fieldEquals("Root", rootEntityId1, "createdAt", "100");
    assert.fieldEquals("Root", rootEntityId1, "blockNumber", "50");

    // --- Assert Provider fields ---
    const providerId = SENDER_ADDRESS.toHex();
    assert.fieldEquals("Provider", providerId, "totalDataSize", expectedTotalSize);
    assert.fieldEquals("Provider", providerId, "updatedAt", "100");
    assert.fieldEquals("Provider", providerId, "blockNumber", "50");
    // Assuming provider was newly created by this event
    // assert.fieldEquals("Provider", providerId, "createdAt", "100");

    // --- Assert EventLog fields ---
    // Construct expected event ID: txHash + logIndex
    const eventId = Bytes.fromHexString(`0x${"c".repeat(64)}`)
      .concatI32(BigInt.fromI32(1).toI32())
      .toHex();
    assert.fieldEquals("EventLog", eventId, "name", "piecesAdded");
    assert.fieldEquals("EventLog", eventId, "setId", SET_ID.toString());
    assert.fieldEquals("EventLog", eventId, "transactionHash", `0x${"c".repeat(64)}`);
    assert.fieldEquals("EventLog", eventId, "blockNumber", "50");
    assert.fieldEquals("EventLog", eventId, "logIndex", "1");
    assert.fieldEquals("EventLog", eventId, "createdAt", "100");
    // Check data field (simple representation)
    const expectedData = `{ "setId": "${SET_ID.toString()}", "pieceIds": [${ROOT_ID_1.toString()}] }`;
    assert.fieldEquals("EventLog", eventId, "data", expectedData);
  });
});

describe("handlePiecesAddedV2 Tests", () => {
  beforeAll(() => {
    // 1. Create the necessary DataSet first (via createDataSet call)
    const mockDataSetCreatedEvent = createDataSetCreatedEvent(
      SET_ID_V2,
      SENDER_ADDRESS,
      CONTRACT_ADDRESS,
      BigInt.fromI32(50),
      BigInt.fromI32(1678886400),
      Bytes.fromHexString(`0x${"b".repeat(64)}`),
      BigInt.fromI32(0),
      LISTENER_ADDRESS,
    );
    handleDataSetCreated(mockDataSetCreatedEvent);

    // 2. Create and handle a single-piece PiecesAddedV2 event
    const piecesAddedV2Event = createPiecesAddedV2Event(
      SET_ID_V2,
      FIRST_PIECE_ID_V2,
      1,
      SENDER_ADDRESS,
      CONTRACT_ADDRESS,
      BigInt.fromI32(50),
      BigInt.fromI32(100),
      PIECES_ADDED_V2_TX_HASH,
      BigInt.fromI32(1),
    );

    handlePiecesAddedV2(piecesAddedV2Event);
  });

  afterAll(() => {
    clearStore();
  });

  test("Packed CID is reconstructed and entities match the legacy PiecesAdded shape", () => {
    // Assert counts
    assert.entityCount("DataSet", 1);
    assert.entityCount("Root", 1);
    assert.entityCount("Provider", 1);
    assert.entityCount("EventLog", 2); // DataSetCreated + PiecesAddedV2

    // --- Assert DataSet fields ---
    const dataSetId = Bytes.fromBigInt(SET_ID_V2).toHex();
    assert.fieldEquals("DataSet", dataSetId, "totalRoots", "1");
    assert.fieldEquals("DataSet", dataSetId, "totalDataSize", RAW_SIZE_1.toString());
    assert.fieldEquals("DataSet", dataSetId, "updatedAt", "100");
    assert.fieldEquals("DataSet", dataSetId, "blockNumber", "50");

    // --- Assert Root fields: header/root packing must decode back to the same CID bytes ---
    const rootEntityId = getRootEntityId(SET_ID_V2, FIRST_PIECE_ID_V2).toHex();
    assert.fieldEquals("Root", rootEntityId, "rootId", FIRST_PIECE_ID_V2.toString());
    assert.fieldEquals("Root", rootEntityId, "setId", SET_ID_V2.toString());
    assert.fieldEquals("Root", rootEntityId, "cid", ROOT_CID_1_STR);
    assert.fieldEquals("Root", rootEntityId, "rawSize", RAW_SIZE_1.toString());
    assert.fieldEquals("Root", rootEntityId, "blockNumber", "50");

    // --- Assert Provider fields ---
    const providerId = SENDER_ADDRESS.toHex();
    assert.fieldEquals("Provider", providerId, "totalDataSize", RAW_SIZE_1.toString());

    // --- Assert EventLog fields: same "piecesAdded" label as the legacy handler ---
    const eventId = PIECES_ADDED_V2_TX_HASH.concatI32(BigInt.fromI32(1).toI32()).toHex();
    assert.fieldEquals("EventLog", eventId, "name", "piecesAdded");
    assert.fieldEquals("EventLog", eventId, "setId", SET_ID_V2.toString());
    const expectedData = `{ "setId": "${SET_ID_V2.toString()}", "pieceIds": [${FIRST_PIECE_ID_V2.toString()}] }`;
    assert.fieldEquals("EventLog", eventId, "data", expectedData);
  });
});

describe("handlePiecesAddedV2 contiguous piece ids Tests", () => {
  beforeAll(() => {
    const mockDataSetCreatedEvent = createDataSetCreatedEvent(
      SET_ID_BATCH,
      SENDER_ADDRESS,
      CONTRACT_ADDRESS,
      BigInt.fromI32(50),
      BigInt.fromI32(1678886400),
      Bytes.fromHexString(`0x${"9".repeat(64)}`),
      BigInt.fromI32(0),
      LISTENER_ADDRESS,
    );
    handleDataSetCreated(mockDataSetCreatedEvent);

    const piecesAddedV2Event = createPiecesAddedV2Event(
      SET_ID_BATCH,
      FIRST_PIECE_ID_BATCH,
      PIECE_COUNT,
      SENDER_ADDRESS,
      CONTRACT_ADDRESS,
    );

    handlePiecesAddedV2(piecesAddedV2Event);
  });

  afterAll(() => {
    clearStore();
  });

  test("piece ids derive from firstPieceId + array index", () => {
    assert.entityCount("Root", PIECE_COUNT);

    for (let i = 0; i < PIECE_COUNT; i++) {
      const rootId = FIRST_PIECE_ID_BATCH.plus(BigInt.fromI32(i));
      const rootEntityId = getRootEntityId(SET_ID_BATCH, rootId).toHex();
      assert.fieldEquals("Root", rootEntityId, "rootId", rootId.toString());
    }

    const dataSetId = Bytes.fromBigInt(SET_ID_BATCH).toHex();
    assert.fieldEquals("DataSet", dataSetId, "totalRoots", PIECE_COUNT.toString());
  });
});

describe("handleDataSetCreated via addPieces Tests", () => {
  beforeAll(() => {
    // DataSetCreated emitted from an addPieces() call (setId=0 means new dataset)
    const event = createDataSetCreatedFromAddPiecesEvent(
      ADD_PIECES_SET_ID,
      SENDER_ADDRESS,
      CONTRACT_ADDRESS,
      ADD_PIECES_LISTENER,
      BigInt.fromI32(100),
      BigInt.fromI32(2000000),
      ADD_PIECES_TX_HASH,
      BigInt.fromI32(0),
    );
    handleDataSetCreated(event);
  });

  afterAll(() => {
    clearStore();
  });

  test("Listener address decoded correctly from addPieces calldata", () => {
    const dataSetId = Bytes.fromBigInt(ADD_PIECES_SET_ID).toHex();
    assert.entityCount("DataSet", 1);
    assert.fieldEquals("DataSet", dataSetId, "setId", ADD_PIECES_SET_ID.toString());
    assert.fieldEquals("DataSet", dataSetId, "listener", ADD_PIECES_LISTENER.toHexString());

    // Transaction method should reflect the actual calling function
    const txId = ADD_PIECES_TX_HASH.toHex();
    assert.fieldEquals("Transaction", txId, "method", "addPieces");
  });
});

describe("handleDataSetCreated with unknown selector", () => {
  beforeAll(() => {
    const event = createDataSetCreatedEvent(
      UNKNOWN_SELECTOR_SET_ID,
      SENDER_ADDRESS,
      CONTRACT_ADDRESS,
      BigInt.fromI32(300),
      BigInt.fromI32(4000000),
      UNKNOWN_SELECTOR_TX_HASH,
      BigInt.fromI32(0),
    );
    // Replace transaction input with an unrecognised selector so the
    // warning branch in decodeListenerAddrFromInput is exercised.
    event.transaction.input = Bytes.fromHexString("0xdeadbeef");
    handleDataSetCreated(event);
  });

  afterAll(() => {
    clearStore();
  });

  test("DataSet is still created and listener falls back to zero address", () => {
    const dataSetId = Bytes.fromBigInt(UNKNOWN_SELECTOR_SET_ID).toHex();
    assert.entityCount("DataSet", 1);
    // decodeListenerAddrFromInput returns the zero address for an unknown selector.
    assert.fieldEquals("DataSet", dataSetId, "listener", "0x0000000000000000000000000000000000000000");
  });
});
