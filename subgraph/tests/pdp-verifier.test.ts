import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { afterAll, assert, beforeAll, clearStore, describe, test } from "matchstick-as/assembly/index";
import {
  handleContractUpgraded,
  handleDataSetCreated,
  handleNextProvingPeriod,
  handlePiecesAdded,
  handlePiecesAddedV2,
  handlePiecesRemoved,
  handlePossessionProven,
} from "../src/pdp-verifier";
import { getRootEntityId, getTransactionEntityId } from "../src/utils/keys";
import {
  createContractUpgradedEvent,
  createDataSetCreatedEvent,
  createDataSetCreatedFromAddPiecesEvent,
  createNextProvingPeriodEvent,
  createPiecesAddedV2Event,
  createPiecesRemovedEvent,
  createPossessionProvenEvent,
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
const SET_ID_MULTI_BATCH = BigInt.fromI32(6);
const FIRST_PIECE_ID_MULTI_BATCH = BigInt.fromI32(400);
const MULTI_BATCH_TX_HASH = Bytes.fromHexString(`0x${"8".repeat(64)}`);
const SET_ID_CROSS_HANDLER = BigInt.fromI32(7);
const CROSS_HANDLER_TX_HASH = Bytes.fromHexString(`0x${"6".repeat(64)}`);
const SET_ID_PIECES_REMOVED = BigInt.fromI32(8);
const FIRST_PIECE_ID_PIECES_REMOVED = BigInt.fromI32(600);
const PIECES_REMOVED_CREATE_TX_HASH = Bytes.fromHexString(`0x${"9".repeat(64)}`);
const PIECES_REMOVED_ADD_TX_HASH = Bytes.fromHexString(`0x${"a1".repeat(32)}`);
const PIECES_REMOVED_TX_HASH = Bytes.fromHexString(`0x${"b2".repeat(32)}`);
const SET_ID_LEGACY_PIECES_REMOVED = BigInt.fromI32(9);
const FIRST_PIECE_ID_LEGACY_PIECES_REMOVED = BigInt.fromI32(700);
const LEGACY_CREATE_TX_HASH = Bytes.fromHexString(`0x${"c3".repeat(32)}`);
const LEGACY_ADD_TX_HASH = Bytes.fromHexString(`0x${"d4".repeat(32)}`);
const LEGACY_PIECES_REMOVED_TX_HASH = Bytes.fromHexString(`0x${"e5".repeat(32)}`);
const SET_ID_VERSIONED_PIECES_REMOVED = BigInt.fromI32(10);
const FIRST_PIECE_ID_VERSIONED_PIECES_REMOVED = BigInt.fromI32(800);
const VERSIONED_CREATE_TX_HASH = Bytes.fromHexString(`0x${"f6".repeat(32)}`);
const VERSIONED_ADD_TX_HASH = Bytes.fromHexString(`0x${"07".repeat(32)}`);
const VERSIONED_PIECES_REMOVED_TX_HASH = Bytes.fromHexString(`0x${"18".repeat(32)}`);
const UPGRADE_IMPLEMENTATION = Address.fromString("0xc16081f360e3847006db660bae1c6d1b2e17ec2c");

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

describe("handlePiecesAddedV2 multi-batch transaction Tests", () => {
  beforeAll(() => {
    const mockDataSetCreatedEvent = createDataSetCreatedFromAddPiecesEvent(
      SET_ID_MULTI_BATCH,
      SENDER_ADDRESS,
      CONTRACT_ADDRESS,
      LISTENER_ADDRESS,
      BigInt.fromI32(50),
      BigInt.fromI32(100),
      MULTI_BATCH_TX_HASH,
      BigInt.fromI32(0),
    );
    handleDataSetCreated(mockDataSetCreatedEvent);

    const firstBatch = createPiecesAddedV2Event(
      SET_ID_MULTI_BATCH,
      FIRST_PIECE_ID_MULTI_BATCH,
      2,
      SENDER_ADDRESS,
      CONTRACT_ADDRESS,
      BigInt.fromI32(50),
      BigInt.fromI32(100),
      MULTI_BATCH_TX_HASH,
      BigInt.fromI32(1),
    );
    handlePiecesAddedV2(firstBatch);

    const secondBatch = createPiecesAddedV2Event(
      SET_ID_MULTI_BATCH,
      FIRST_PIECE_ID_MULTI_BATCH.plus(BigInt.fromI32(2)),
      2,
      SENDER_ADDRESS,
      CONTRACT_ADDRESS,
      BigInt.fromI32(50),
      BigInt.fromI32(100),
      MULTI_BATCH_TX_HASH,
      BigInt.fromI32(2),
    );
    handlePiecesAddedV2(secondBatch);
  });

  afterAll(() => {
    clearStore();
  });

  test("counts one transaction and all three event logs", () => {
    const dataSetId = Bytes.fromBigInt(SET_ID_MULTI_BATCH).toHex();

    // handleDataSetCreated and handlePiecesAddedV2 both call the shared getOrCreateTransaction, which
    // must agree there's only one Transaction for this hash across all three calls.
    assert.entityCount("Transaction", 1);
    assert.entityCount("EventLog", 3); // DataSetCreated + two PiecesAddedV2 batches
    assert.fieldEquals(
      "Transaction",
      getTransactionEntityId(MULTI_BATCH_TX_HASH, SET_ID_MULTI_BATCH, "addPieces").toHex(),
      "method",
      "addPieces",
    );
    assert.fieldEquals("DataSet", dataSetId, "totalTransactions", "1");
    assert.fieldEquals("DataSet", dataSetId, "totalEventLogs", "3");
    assert.fieldEquals("DataSet", dataSetId, "totalRoots", "4");
  });
});

describe("cross-handler transaction dedup Tests", () => {
  // Distinct methods in one outer transaction get separate rows.
  beforeAll(() => {
    const mockDataSetCreatedEvent = createDataSetCreatedEvent(
      SET_ID_CROSS_HANDLER,
      SENDER_ADDRESS,
      CONTRACT_ADDRESS,
      BigInt.fromI32(49),
      BigInt.fromI32(99),
      Bytes.fromHexString(`0x${"5".repeat(64)}`),
      BigInt.fromI32(0),
      LISTENER_ADDRESS,
    );
    handleDataSetCreated(mockDataSetCreatedEvent);

    const possessionProvenEvent = createPossessionProvenEvent(
      SET_ID_CROSS_HANDLER,
      [],
      [],
      CONTRACT_ADDRESS,
      BigInt.fromI32(50),
      BigInt.fromI32(100),
      CROSS_HANDLER_TX_HASH,
      BigInt.fromI32(1),
    );
    handlePossessionProven(possessionProvenEvent);

    const nextProvingPeriodEvent = createNextProvingPeriodEvent(
      SET_ID_CROSS_HANDLER,
      BigInt.fromI32(200),
      BigInt.fromI32(0),
      CONTRACT_ADDRESS,
      BigInt.fromI32(50),
      BigInt.fromI32(100),
      CROSS_HANDLER_TX_HASH,
      BigInt.fromI32(2),
    );
    handleNextProvingPeriod(nextProvingPeriodEvent);
  });

  afterAll(() => {
    clearStore();
  });

  test("PossessionProven and NextProvingPeriod sharing a hash count as two transactions, one per method", () => {
    const dataSetId = Bytes.fromBigInt(SET_ID_CROSS_HANDLER).toHex();

    // 1 Transaction for DataSetCreated's own hash + 2 for the shared hash (provePossession, nextProvingPeriod).
    assert.entityCount("Transaction", 3);
    assert.entityCount("EventLog", 3);
    assert.fieldEquals(
      "Transaction",
      getTransactionEntityId(CROSS_HANDLER_TX_HASH, SET_ID_CROSS_HANDLER, "provePossession").toHex(),
      "method",
      "provePossession",
    );
    assert.fieldEquals(
      "Transaction",
      getTransactionEntityId(CROSS_HANDLER_TX_HASH, SET_ID_CROSS_HANDLER, "nextProvingPeriod").toHex(),
      "method",
      "nextProvingPeriod",
    );
    assert.fieldEquals("DataSet", dataSetId, "totalTransactions", "3");
    assert.fieldEquals("DataSet", dataSetId, "totalEventLogs", "3");
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
    const txId = getTransactionEntityId(ADD_PIECES_TX_HASH, ADD_PIECES_SET_ID, "addPieces").toHex();
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

describe("handlePiecesRemoved Tests", () => {
  beforeAll(() => {
    // Enable standalone processPieceDeletions behavior.
    const contractUpgradedEvent = createContractUpgradedEvent(
      "3.5.0",
      UPGRADE_IMPLEMENTATION,
      CONTRACT_ADDRESS,
      BigInt.fromI32(49),
      BigInt.fromI32(99),
    );
    handleContractUpgraded(contractUpgradedEvent);

    const mockDataSetCreatedEvent = createDataSetCreatedEvent(
      SET_ID_PIECES_REMOVED,
      SENDER_ADDRESS,
      CONTRACT_ADDRESS,
      BigInt.fromI32(50),
      BigInt.fromI32(100),
      PIECES_REMOVED_CREATE_TX_HASH,
      BigInt.fromI32(0),
      LISTENER_ADDRESS,
    );
    handleDataSetCreated(mockDataSetCreatedEvent);

    const piecesAddedEvent = createPiecesAddedV2Event(
      SET_ID_PIECES_REMOVED,
      FIRST_PIECE_ID_PIECES_REMOVED,
      1,
      SENDER_ADDRESS,
      CONTRACT_ADDRESS,
      BigInt.fromI32(51),
      BigInt.fromI32(101),
      PIECES_REMOVED_ADD_TX_HASH,
      BigInt.fromI32(0),
    );
    handlePiecesAddedV2(piecesAddedEvent);

    const piecesRemovedEvent = createPiecesRemovedEvent(
      SET_ID_PIECES_REMOVED,
      [FIRST_PIECE_ID_PIECES_REMOVED],
      CONTRACT_ADDRESS,
      BigInt.fromI32(52),
      BigInt.fromI32(102),
      PIECES_REMOVED_TX_HASH,
      BigInt.fromI32(0),
    );
    handlePiecesRemoved(piecesRemovedEvent);
  });

  afterAll(() => {
    clearStore();
  });

  test("creates its own Transaction row instead of leaving EventLog.transaction dangling", () => {
    const dataSetId = Bytes.fromBigInt(SET_ID_PIECES_REMOVED).toHex();
    const txId = getTransactionEntityId(PIECES_REMOVED_TX_HASH, SET_ID_PIECES_REMOVED, "processPieceDeletions").toHex();

    // 1 Transaction each for DataSetCreated, PiecesAddedV2 and PiecesRemoved.
    assert.entityCount("Transaction", 3);
    assert.fieldEquals("Transaction", txId, "method", "processPieceDeletions");
    assert.fieldEquals("Transaction", txId, "dataSetId", SET_ID_PIECES_REMOVED.toString());
    assert.fieldEquals("DataSet", dataSetId, "totalTransactions", "3");
    assert.fieldEquals("DataSet", dataSetId, "totalRoots", "0");
  });
});

describe("handlePiecesRemoved emitted by pre-upgrade nextProvingPeriod Tests", () => {
  beforeAll(() => {
    const mockDataSetCreatedEvent = createDataSetCreatedEvent(
      SET_ID_LEGACY_PIECES_REMOVED,
      SENDER_ADDRESS,
      CONTRACT_ADDRESS,
      BigInt.fromI32(60),
      BigInt.fromI32(110),
      LEGACY_CREATE_TX_HASH,
      BigInt.fromI32(0),
      LISTENER_ADDRESS,
    );
    handleDataSetCreated(mockDataSetCreatedEvent);

    const piecesAddedEvent = createPiecesAddedV2Event(
      SET_ID_LEGACY_PIECES_REMOVED,
      FIRST_PIECE_ID_LEGACY_PIECES_REMOVED,
      1,
      SENDER_ADDRESS,
      CONTRACT_ADDRESS,
      BigInt.fromI32(61),
      BigInt.fromI32(111),
      LEGACY_ADD_TX_HASH,
      BigInt.fromI32(0),
    );
    handlePiecesAddedV2(piecesAddedEvent);

    // Without an upgrade, PiecesRemoved belongs to nextProvingPeriod.
    const piecesRemovedEvent = createPiecesRemovedEvent(
      SET_ID_LEGACY_PIECES_REMOVED,
      [FIRST_PIECE_ID_LEGACY_PIECES_REMOVED],
      CONTRACT_ADDRESS,
      BigInt.fromI32(62),
      BigInt.fromI32(112),
      LEGACY_PIECES_REMOVED_TX_HASH,
      BigInt.fromI32(0),
    );
    handlePiecesRemoved(piecesRemovedEvent);

    const nextProvingPeriodEvent = createNextProvingPeriodEvent(
      SET_ID_LEGACY_PIECES_REMOVED,
      BigInt.fromI32(1),
      BigInt.fromI32(0),
      CONTRACT_ADDRESS,
      BigInt.fromI32(62),
      BigInt.fromI32(112),
      LEGACY_PIECES_REMOVED_TX_HASH,
      BigInt.fromI32(1),
    );
    handleNextProvingPeriod(nextProvingPeriodEvent);
  });

  afterAll(() => {
    clearStore();
  });

  test("defers Transaction creation to handleNextProvingPeriod instead of mislabeling it processPieceDeletions", () => {
    const dataSetId = Bytes.fromBigInt(SET_ID_LEGACY_PIECES_REMOVED).toHex();
    const txId = getTransactionEntityId(
      LEGACY_PIECES_REMOVED_TX_HASH,
      SET_ID_LEGACY_PIECES_REMOVED,
      "nextProvingPeriod",
    ).toHex();

    // 1 Transaction each for DataSetCreated, PiecesAddedV2, and the shared PiecesRemoved+NextProvingPeriod tx.
    assert.entityCount("Transaction", 3);
    assert.fieldEquals("Transaction", txId, "method", "nextProvingPeriod");
    assert.fieldEquals("DataSet", dataSetId, "totalTransactions", "3");
  });
});

describe("handleContractUpgraded Tests", () => {
  afterAll(() => {
    clearStore();
  });

  test("records the live version and implementation", () => {
    const event = createContractUpgradedEvent(
      "3.5.0",
      UPGRADE_IMPLEMENTATION,
      CONTRACT_ADDRESS,
      BigInt.fromI32(1),
      BigInt.fromI32(1),
    );
    handleContractUpgraded(event);

    const versionId = Bytes.fromUTF8("pdp_verifier_version").toHex();
    assert.entityCount("ContractVersion", 1);
    assert.fieldEquals("ContractVersion", versionId, "version", "3.5.0");
    assert.fieldEquals("ContractVersion", versionId, "implementation", UPGRADE_IMPLEMENTATION.toHexString());
    assert.fieldEquals("ContractVersion", versionId, "updatedAtBlock", "1");
  });

  // Compare semantic versions numerically, not lexicographically.
  test("a double-digit minor version still resolves to the current processPieceDeletions behavior", () => {
    const upgradeEvent = createContractUpgradedEvent(
      "3.10.0",
      UPGRADE_IMPLEMENTATION,
      CONTRACT_ADDRESS,
      BigInt.fromI32(1),
      BigInt.fromI32(1),
    );
    handleContractUpgraded(upgradeEvent);

    const mockDataSetCreatedEvent = createDataSetCreatedEvent(
      SET_ID_VERSIONED_PIECES_REMOVED,
      SENDER_ADDRESS,
      CONTRACT_ADDRESS,
      BigInt.fromI32(2),
      BigInt.fromI32(2),
      VERSIONED_CREATE_TX_HASH,
      BigInt.fromI32(0),
      LISTENER_ADDRESS,
    );
    handleDataSetCreated(mockDataSetCreatedEvent);

    const piecesAddedEvent = createPiecesAddedV2Event(
      SET_ID_VERSIONED_PIECES_REMOVED,
      FIRST_PIECE_ID_VERSIONED_PIECES_REMOVED,
      1,
      SENDER_ADDRESS,
      CONTRACT_ADDRESS,
      BigInt.fromI32(3),
      BigInt.fromI32(3),
      VERSIONED_ADD_TX_HASH,
      BigInt.fromI32(0),
    );
    handlePiecesAddedV2(piecesAddedEvent);

    const piecesRemovedEvent = createPiecesRemovedEvent(
      SET_ID_VERSIONED_PIECES_REMOVED,
      [FIRST_PIECE_ID_VERSIONED_PIECES_REMOVED],
      CONTRACT_ADDRESS,
      BigInt.fromI32(4),
      BigInt.fromI32(4),
      VERSIONED_PIECES_REMOVED_TX_HASH,
      BigInt.fromI32(0),
    );
    handlePiecesRemoved(piecesRemovedEvent);

    const txId = getTransactionEntityId(
      VERSIONED_PIECES_REMOVED_TX_HASH,
      SET_ID_VERSIONED_PIECES_REMOVED,
      "processPieceDeletions",
    ).toHex();
    assert.fieldEquals("Transaction", txId, "method", "processPieceDeletions");
  });
});
