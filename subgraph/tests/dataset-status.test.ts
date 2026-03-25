import {
  assert,
  describe,
  test,
  clearStore,
  afterEach,
} from "matchstick-as/assembly/index";
import { BigInt, Address, Bytes } from "@graphprotocol/graph-ts";
import {
  handleDataSetCreated,
  handlePiecesAdded,
  handleNextProvingPeriod,
  handleDataSetDeleted,
  handleDataSetEmpty,
} from "../src/pdp-verifier";
import {
  createDataSetCreatedEvent,
  createRootsAddedEvent,
  createNextProvingPeriodEvent,
  createDataSetDeletedEvent,
  createDataSetEmptyEvent,
  generateTxHash,
} from "./pdp-verifier-utils";

const SET_ID = BigInt.fromI32(1);
const ROOT_ID_1 = BigInt.fromI32(101);
const SENDER_ADDRESS = Address.fromString(
  "0xa16081f360e3847006db660bae1c6d1b2e17ec2a"
);
const CONTRACT_ADDRESS = Address.fromString(
  "0xb16081f360e3847006db660bae1c6d1b2e17ec2b"
);
const PROOF_SET_ID_BYTES = Bytes.fromBigInt(SET_ID);

describe("DataSetStatus Lifecycle Tests", () => {
  afterEach(() => {
    clearStore();
  });

  test("handleDataSetCreated sets status to EMPTY", () => {
    let mockDataSetCreatedEvent = createDataSetCreatedEvent(
      SET_ID,
      SENDER_ADDRESS,
      Bytes.fromI32(123),
      CONTRACT_ADDRESS,
      BigInt.fromI32(100),
      BigInt.fromI32(1678886400),
      generateTxHash(1),
      BigInt.fromI32(0)
    );

    handleDataSetCreated(mockDataSetCreatedEvent);

    let dataSetId = PROOF_SET_ID_BYTES.toHex();
    assert.fieldEquals("DataSet", dataSetId, "status", "EMPTY");
    assert.fieldEquals("DataSet", dataSetId, "isActive", "true");
    assert.fieldEquals("DataSet", dataSetId, "totalDataSize", "0");
  });

  test("handlePiecesAdded transitions status from EMPTY to READY", () => {
    let mockDataSetCreatedEvent = createDataSetCreatedEvent(
      SET_ID,
      SENDER_ADDRESS,
      Bytes.fromI32(123),
      CONTRACT_ADDRESS,
      BigInt.fromI32(100),
      BigInt.fromI32(1678886400),
      generateTxHash(10),
      BigInt.fromI32(0)
    );
    handleDataSetCreated(mockDataSetCreatedEvent);

    let dataSetId = PROOF_SET_ID_BYTES.toHex();
    assert.fieldEquals("DataSet", dataSetId, "status", "EMPTY");

    let pieceIds = [ROOT_ID_1];
    let rootsAddedEvent = createRootsAddedEvent(
      SET_ID,
      pieceIds,
      SENDER_ADDRESS,
      CONTRACT_ADDRESS
    );
    rootsAddedEvent.block.timestamp = BigInt.fromI32(1678886500);
    rootsAddedEvent.block.number = BigInt.fromI32(150);
    rootsAddedEvent.logIndex = BigInt.fromI32(1);
    rootsAddedEvent.transaction.hash = generateTxHash(11);

    handlePiecesAdded(rootsAddedEvent);

    assert.fieldEquals("DataSet", dataSetId, "status", "READY");
    assert.fieldEquals("DataSet", dataSetId, "isActive", "true");
  });

  test("handleNextProvingPeriod transitions status from READY to PROVING", () => {
    let mockDataSetCreatedEvent = createDataSetCreatedEvent(
      SET_ID,
      SENDER_ADDRESS,
      Bytes.fromI32(123),
      CONTRACT_ADDRESS,
      BigInt.fromI32(100),
      BigInt.fromI32(1678886400),
      generateTxHash(20),
      BigInt.fromI32(0)
    );
    handleDataSetCreated(mockDataSetCreatedEvent);

    let pieceIds = [ROOT_ID_1];
    let rootsAddedEvent = createRootsAddedEvent(
      SET_ID,
      pieceIds,
      SENDER_ADDRESS,
      CONTRACT_ADDRESS
    );
    rootsAddedEvent.block.timestamp = BigInt.fromI32(1678886500);
    rootsAddedEvent.block.number = BigInt.fromI32(150);
    rootsAddedEvent.logIndex = BigInt.fromI32(1);
    rootsAddedEvent.transaction.hash = generateTxHash(21);
    handlePiecesAdded(rootsAddedEvent);

    let dataSetId = PROOF_SET_ID_BYTES.toHex();
    assert.fieldEquals("DataSet", dataSetId, "status", "READY");

    let nextProvingPeriodEvent = createNextProvingPeriodEvent(
      SET_ID,
      BigInt.fromI32(200),
      BigInt.fromI32(32),
      CONTRACT_ADDRESS,
      BigInt.fromI32(200),
      BigInt.fromI32(1678886600),
      generateTxHash(22),
      BigInt.fromI32(0)
    );

    handleNextProvingPeriod(nextProvingPeriodEvent);

    assert.fieldEquals("DataSet", dataSetId, "status", "PROVING");
    assert.fieldEquals("DataSet", dataSetId, "isActive", "true");
    assert.fieldEquals("DataSet", dataSetId, "firstDeadline", "200");
  });

  test("handleDataSetDeleted transitions status to DELETED", () => {
    let mockDataSetCreatedEvent = createDataSetCreatedEvent(
      SET_ID,
      SENDER_ADDRESS,
      Bytes.fromI32(123),
      CONTRACT_ADDRESS,
      BigInt.fromI32(100),
      BigInt.fromI32(1678886400),
      generateTxHash(30),
      BigInt.fromI32(0)
    );
    handleDataSetCreated(mockDataSetCreatedEvent);

    let pieceIds = [ROOT_ID_1];
    let rootsAddedEvent = createRootsAddedEvent(
      SET_ID,
      pieceIds,
      SENDER_ADDRESS,
      CONTRACT_ADDRESS
    );
    rootsAddedEvent.block.timestamp = BigInt.fromI32(1678886500);
    rootsAddedEvent.block.number = BigInt.fromI32(150);
    rootsAddedEvent.logIndex = BigInt.fromI32(1);
    rootsAddedEvent.transaction.hash = generateTxHash(31);
    handlePiecesAdded(rootsAddedEvent);

    let dataSetId = PROOF_SET_ID_BYTES.toHex();
    assert.fieldEquals("DataSet", dataSetId, "status", "READY");

    let dataSetDeletedEvent = createDataSetDeletedEvent(
      SET_ID,
      BigInt.fromI32(32),
      CONTRACT_ADDRESS,
      BigInt.fromI32(200),
      BigInt.fromI32(1678886700),
      generateTxHash(32),
      BigInt.fromI32(0)
    );

    handleDataSetDeleted(dataSetDeletedEvent);

    assert.fieldEquals("DataSet", dataSetId, "status", "DELETED");
    assert.fieldEquals("DataSet", dataSetId, "isActive", "false");
    assert.fieldEquals("DataSet", dataSetId, "totalRoots", "0");
    assert.fieldEquals("DataSet", dataSetId, "totalDataSize", "0");
  });

  test("handleDataSetEmpty transitions status to EMPTY", () => {
    let mockDataSetCreatedEvent = createDataSetCreatedEvent(
      SET_ID,
      SENDER_ADDRESS,
      Bytes.fromI32(123),
      CONTRACT_ADDRESS,
      BigInt.fromI32(100),
      BigInt.fromI32(1678886400),
      generateTxHash(40),
      BigInt.fromI32(0)
    );
    handleDataSetCreated(mockDataSetCreatedEvent);

    let pieceIds = [ROOT_ID_1];
    let rootsAddedEvent = createRootsAddedEvent(
      SET_ID,
      pieceIds,
      SENDER_ADDRESS,
      CONTRACT_ADDRESS
    );
    rootsAddedEvent.block.timestamp = BigInt.fromI32(1678886500);
    rootsAddedEvent.block.number = BigInt.fromI32(150);
    rootsAddedEvent.logIndex = BigInt.fromI32(1);
    rootsAddedEvent.transaction.hash = generateTxHash(41);
    handlePiecesAdded(rootsAddedEvent);

    let dataSetId = PROOF_SET_ID_BYTES.toHex();
    assert.fieldEquals("DataSet", dataSetId, "status", "READY");

    let dataSetEmptyEvent = createDataSetEmptyEvent(
      SET_ID,
      CONTRACT_ADDRESS,
      BigInt.fromI32(200),
      BigInt.fromI32(1678886700),
      generateTxHash(42),
      BigInt.fromI32(0)
    );

    handleDataSetEmpty(dataSetEmptyEvent);

    assert.fieldEquals("DataSet", dataSetId, "status", "EMPTY");
    assert.fieldEquals("DataSet", dataSetId, "totalRoots", "0");
    assert.fieldEquals("DataSet", dataSetId, "totalDataSize", "0");
    assert.fieldEquals("DataSet", dataSetId, "leafCount", "0");
  });

  test("handleDataSetDeleted from PROVING status transitions to DELETED", () => {
    let mockDataSetCreatedEvent = createDataSetCreatedEvent(
      SET_ID,
      SENDER_ADDRESS,
      Bytes.fromI32(123),
      CONTRACT_ADDRESS,
      BigInt.fromI32(100),
      BigInt.fromI32(1678886400),
      generateTxHash(50),
      BigInt.fromI32(0)
    );
    handleDataSetCreated(mockDataSetCreatedEvent);

    let pieceIds = [ROOT_ID_1];
    let rootsAddedEvent = createRootsAddedEvent(
      SET_ID,
      pieceIds,
      SENDER_ADDRESS,
      CONTRACT_ADDRESS
    );
    rootsAddedEvent.block.timestamp = BigInt.fromI32(1678886500);
    rootsAddedEvent.block.number = BigInt.fromI32(150);
    rootsAddedEvent.logIndex = BigInt.fromI32(1);
    rootsAddedEvent.transaction.hash = generateTxHash(51);
    handlePiecesAdded(rootsAddedEvent);

    let nextProvingPeriodEvent = createNextProvingPeriodEvent(
      SET_ID,
      BigInt.fromI32(200),
      BigInt.fromI32(32),
      CONTRACT_ADDRESS,
      BigInt.fromI32(200),
      BigInt.fromI32(1678886600),
      generateTxHash(52),
      BigInt.fromI32(0)
    );
    handleNextProvingPeriod(nextProvingPeriodEvent);

    let dataSetId = PROOF_SET_ID_BYTES.toHex();
    assert.fieldEquals("DataSet", dataSetId, "status", "PROVING");

    let dataSetDeletedEvent = createDataSetDeletedEvent(
      SET_ID,
      BigInt.fromI32(32),
      CONTRACT_ADDRESS,
      BigInt.fromI32(250),
      BigInt.fromI32(1678886800),
      generateTxHash(53),
      BigInt.fromI32(0)
    );

    handleDataSetDeleted(dataSetDeletedEvent);

    assert.fieldEquals("DataSet", dataSetId, "status", "DELETED");
    assert.fieldEquals("DataSet", dataSetId, "isActive", "false");
  });

  test("handleDataSetEmpty from PROVING status transitions to EMPTY", () => {
    let mockDataSetCreatedEvent = createDataSetCreatedEvent(
      SET_ID,
      SENDER_ADDRESS,
      Bytes.fromI32(123),
      CONTRACT_ADDRESS,
      BigInt.fromI32(100),
      BigInt.fromI32(1678886400),
      generateTxHash(60),
      BigInt.fromI32(0)
    );
    handleDataSetCreated(mockDataSetCreatedEvent);

    let pieceIds = [ROOT_ID_1];
    let rootsAddedEvent = createRootsAddedEvent(
      SET_ID,
      pieceIds,
      SENDER_ADDRESS,
      CONTRACT_ADDRESS
    );
    rootsAddedEvent.block.timestamp = BigInt.fromI32(1678886500);
    rootsAddedEvent.block.number = BigInt.fromI32(150);
    rootsAddedEvent.logIndex = BigInt.fromI32(1);
    rootsAddedEvent.transaction.hash = generateTxHash(61);
    handlePiecesAdded(rootsAddedEvent);

    let nextProvingPeriodEvent = createNextProvingPeriodEvent(
      SET_ID,
      BigInt.fromI32(200),
      BigInt.fromI32(32),
      CONTRACT_ADDRESS,
      BigInt.fromI32(200),
      BigInt.fromI32(1678886600),
      generateTxHash(62),
      BigInt.fromI32(0)
    );
    handleNextProvingPeriod(nextProvingPeriodEvent);

    let dataSetId = PROOF_SET_ID_BYTES.toHex();
    assert.fieldEquals("DataSet", dataSetId, "status", "PROVING");

    let dataSetEmptyEvent = createDataSetEmptyEvent(
      SET_ID,
      CONTRACT_ADDRESS,
      BigInt.fromI32(250),
      BigInt.fromI32(1678886800),
      generateTxHash(63),
      BigInt.fromI32(0)
    );

    handleDataSetEmpty(dataSetEmptyEvent);

    assert.fieldEquals("DataSet", dataSetId, "status", "EMPTY");
    assert.fieldEquals("DataSet", dataSetId, "totalRoots", "0");
    assert.fieldEquals("DataSet", dataSetId, "totalDataSize", "0");
  });

  test("Status remains EMPTY when no pieces are added", () => {
    let mockDataSetCreatedEvent = createDataSetCreatedEvent(
      SET_ID,
      SENDER_ADDRESS,
      Bytes.fromI32(123),
      CONTRACT_ADDRESS,
      BigInt.fromI32(100),
      BigInt.fromI32(1678886400),
      generateTxHash(70),
      BigInt.fromI32(0)
    );
    handleDataSetCreated(mockDataSetCreatedEvent);

    let dataSetId = PROOF_SET_ID_BYTES.toHex();

    assert.fieldEquals("DataSet", dataSetId, "status", "EMPTY");
    assert.fieldEquals("DataSet", dataSetId, "totalDataSize", "0");
    assert.fieldEquals("DataSet", dataSetId, "leafCount", "0");
  });

  test("Multiple pieces added keeps status as READY", () => {
    let mockDataSetCreatedEvent = createDataSetCreatedEvent(
      SET_ID,
      SENDER_ADDRESS,
      Bytes.fromI32(123),
      CONTRACT_ADDRESS,
      BigInt.fromI32(100),
      BigInt.fromI32(1678886400),
      generateTxHash(80),
      BigInt.fromI32(0)
    );
    handleDataSetCreated(mockDataSetCreatedEvent);

    let pieceIds1 = [ROOT_ID_1];
    let rootsAddedEvent1 = createRootsAddedEvent(
      SET_ID,
      pieceIds1,
      SENDER_ADDRESS,
      CONTRACT_ADDRESS
    );
    rootsAddedEvent1.block.timestamp = BigInt.fromI32(1678886500);
    rootsAddedEvent1.block.number = BigInt.fromI32(150);
    rootsAddedEvent1.logIndex = BigInt.fromI32(1);
    rootsAddedEvent1.transaction.hash = generateTxHash(81);
    handlePiecesAdded(rootsAddedEvent1);

    let dataSetId = PROOF_SET_ID_BYTES.toHex();
    assert.fieldEquals("DataSet", dataSetId, "status", "READY");

    let pieceIds2 = [BigInt.fromI32(102)];
    let rootsAddedEvent2 = createRootsAddedEvent(
      SET_ID,
      pieceIds2,
      SENDER_ADDRESS,
      CONTRACT_ADDRESS
    );
    rootsAddedEvent2.block.timestamp = BigInt.fromI32(1678886600);
    rootsAddedEvent2.block.number = BigInt.fromI32(160);
    rootsAddedEvent2.logIndex = BigInt.fromI32(1);
    rootsAddedEvent2.transaction.hash = generateTxHash(82);
    handlePiecesAdded(rootsAddedEvent2);

    assert.fieldEquals("DataSet", dataSetId, "status", "READY");
  });
});
