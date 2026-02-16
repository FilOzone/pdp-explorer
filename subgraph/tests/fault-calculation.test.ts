import {
  assert,
  describe,
  test,
  clearStore,
  beforeEach,
  afterEach,
} from "matchstick-as/assembly/index";
import { BigInt, Address, Bytes } from "@graphprotocol/graph-ts";
import {
  handleDataSetCreated,
  handleNextProvingPeriod,
  handlePossessionProven,
} from "../src/pdp-verifier";
import {
  createDataSetCreatedEvent,
  createNextProvingPeriodEvent,
  createPossessionProvenEvent,
} from "./pdp-verifier-utils";

const SET_ID = BigInt.fromI32(1);
const PROVIDER_ADDRESS = Address.fromString(
  "0xa16081f360e3847006db660bae1c6d1b2e17ec2a"
);
const CONTRACT_ADDRESS = Address.fromString(
  "0xb16081f360e3847006db660bae1c6d1b2e17ec2b"
);
const LISTENER_ADDRESS = Address.fromString(
  "0x0000000000000000000000000000000000000001"
);
const MAX_PROVING_PERIOD = BigInt.fromI32(240);
const CHALLENGE_WINDOW_SIZE = BigInt.fromI32(20);

function getProofSetId(): string {
  return Bytes.fromBigInt(SET_ID).toHex();
}

function getProviderId(): string {
  return PROVIDER_ADDRESS.toHex();
}

describe("Fault Calculation Tests", () => {
  beforeEach(() => {
    clearStore();
  });

  afterEach(() => {
    clearStore();
  });

  test("Test 1: DataSet creation initializes with zero values", () => {
    const blockNumber = BigInt.fromI32(100);
    const timestamp = BigInt.fromI32(1000);

    const dataSetCreatedEvent = createDataSetCreatedEvent(
      SET_ID,
      PROVIDER_ADDRESS,
      CONTRACT_ADDRESS,
      LISTENER_ADDRESS,
      blockNumber,
      timestamp
    );

    handleDataSetCreated(dataSetCreatedEvent);

    const proofSetId = getProofSetId();
    const providerId = getProviderId();

    assert.entityCount("DataSet", 1);
    assert.entityCount("Provider", 1);

    assert.fieldEquals("DataSet", proofSetId, "setId", SET_ID.toString());
    assert.fieldEquals("DataSet", proofSetId, "nextDeadline", "0");
    assert.fieldEquals("DataSet", proofSetId, "firstDeadline", "0");
    assert.fieldEquals("DataSet", proofSetId, "maxProvingPeriod", "0");
    assert.fieldEquals("DataSet", proofSetId, "challengeWindowSize", "0");
    assert.fieldEquals("DataSet", proofSetId, "currentDeadlineCount", "0");
    assert.fieldEquals("DataSet", proofSetId, "provenThisPeriod", "false");
    assert.fieldEquals("DataSet", proofSetId, "totalFaultedPeriods", "0");

    assert.fieldEquals("Provider", providerId, "totalFaultedPeriods", "0");
    assert.fieldEquals("Provider", providerId, "totalProvingPeriods", "0");
  });

  test("Test 2: First nextProvingPeriod call sets initial deadline", () => {
    const createBlockNumber = BigInt.fromI32(100);
    const createTimestamp = BigInt.fromI32(1000);
    const firstProvingBlockNumber = BigInt.fromI32(150);
    const firstProvingTimestamp = BigInt.fromI32(1500);
    const challengeEpoch = BigInt.fromI32(200);
    const leafCount = BigInt.fromI32(1000);

    const dataSetCreatedEvent = createDataSetCreatedEvent(
      SET_ID,
      PROVIDER_ADDRESS,
      CONTRACT_ADDRESS,
      LISTENER_ADDRESS,
      createBlockNumber,
      createTimestamp
    );
    handleDataSetCreated(dataSetCreatedEvent);

    const nextProvingPeriodEvent = createNextProvingPeriodEvent(
      SET_ID,
      challengeEpoch,
      leafCount,
      CONTRACT_ADDRESS,
      firstProvingBlockNumber,
      firstProvingTimestamp
    );
    handleNextProvingPeriod(nextProvingPeriodEvent);

    const proofSetId = getProofSetId();
    const providerId = getProviderId();
    const expectedNextDeadline =
      firstProvingBlockNumber.plus(MAX_PROVING_PERIOD);

    assert.fieldEquals(
      "DataSet",
      proofSetId,
      "firstDeadline",
      firstProvingBlockNumber.toString()
    );
    assert.fieldEquals(
      "DataSet",
      proofSetId,
      "maxProvingPeriod",
      MAX_PROVING_PERIOD.toString()
    );
    assert.fieldEquals(
      "DataSet",
      proofSetId,
      "challengeWindowSize",
      CHALLENGE_WINDOW_SIZE.toString()
    );
    assert.fieldEquals(
      "DataSet",
      proofSetId,
      "nextDeadline",
      expectedNextDeadline.toString()
    );
    assert.fieldEquals("DataSet", proofSetId, "currentDeadlineCount", "1");
    assert.fieldEquals("DataSet", proofSetId, "provenThisPeriod", "false");
    assert.fieldEquals("DataSet", proofSetId, "totalFaultedPeriods", "0");
    assert.fieldEquals(
      "DataSet",
      proofSetId,
      "nextChallengeEpoch",
      challengeEpoch.toString()
    );
    assert.fieldEquals(
      "DataSet",
      proofSetId,
      "challengeRange",
      leafCount.toString()
    );

    assert.fieldEquals("Provider", providerId, "totalFaultedPeriods", "0");
    assert.fieldEquals("Provider", providerId, "totalProvingPeriods", "1");

    const provingWindowId = Bytes.fromUTF8(SET_ID.toString() + "-1").toHex();
    assert.entityCount("ProvingWindow", 1);
    assert.fieldEquals("ProvingWindow", provingWindowId, "deadlineCount", "1");
    assert.fieldEquals(
      "ProvingWindow",
      provingWindowId,
      "deadline",
      expectedNextDeadline.toString()
    );
    assert.fieldEquals(
      "ProvingWindow",
      provingWindowId,
      "windowStart",
      expectedNextDeadline.minus(CHALLENGE_WINDOW_SIZE).toString()
    );
    assert.fieldEquals(
      "ProvingWindow",
      provingWindowId,
      "windowEnd",
      expectedNextDeadline.toString()
    );
    assert.fieldEquals(
      "ProvingWindow",
      provingWindowId,
      "proofSubmitted",
      "false"
    );
    assert.fieldEquals("ProvingWindow", provingWindowId, "isValid", "false");
  });

  test("Test 3: Second nextProvingPeriod without proof submission - 1 faulted period", () => {
    const createBlockNumber = BigInt.fromI32(100);
    const firstProvingBlockNumber = BigInt.fromI32(150);
    const secondProvingBlockNumber = BigInt.fromI32(400);
    const challengeEpoch = BigInt.fromI32(200);
    const leafCount = BigInt.fromI32(1000);

    const dataSetCreatedEvent = createDataSetCreatedEvent(
      SET_ID,
      PROVIDER_ADDRESS,
      CONTRACT_ADDRESS,
      LISTENER_ADDRESS,
      createBlockNumber,
      BigInt.fromI32(1000)
    );
    handleDataSetCreated(dataSetCreatedEvent);

    const firstNextProvingPeriodEvent = createNextProvingPeriodEvent(
      SET_ID,
      challengeEpoch,
      leafCount,
      CONTRACT_ADDRESS,
      firstProvingBlockNumber,
      BigInt.fromI32(1500)
    );
    handleNextProvingPeriod(firstNextProvingPeriodEvent);

    const firstDeadline = firstProvingBlockNumber.plus(MAX_PROVING_PERIOD);

    const secondNextProvingPeriodEvent = createNextProvingPeriodEvent(
      SET_ID,
      challengeEpoch.plus(BigInt.fromI32(100)),
      leafCount,
      CONTRACT_ADDRESS,
      secondProvingBlockNumber,
      BigInt.fromI32(2000)
    );
    handleNextProvingPeriod(secondNextProvingPeriodEvent);

    const proofSetId = getProofSetId();
    const providerId = getProviderId();

    const periodsSkipped = secondProvingBlockNumber
      .minus(firstDeadline.plus(BigInt.fromI32(1)))
      .div(MAX_PROVING_PERIOD);
    const expectedNextDeadline = firstDeadline.plus(
      MAX_PROVING_PERIOD.times(periodsSkipped.plus(BigInt.fromI32(1)))
    );
    const expectedFaultedPeriods = periodsSkipped.plus(BigInt.fromI32(1));

    assert.fieldEquals(
      "DataSet",
      proofSetId,
      "nextDeadline",
      expectedNextDeadline.toString()
    );
    assert.fieldEquals("DataSet", proofSetId, "currentDeadlineCount", "2");
    assert.fieldEquals("DataSet", proofSetId, "provenThisPeriod", "false");
    assert.fieldEquals(
      "DataSet",
      proofSetId,
      "totalFaultedPeriods",
      expectedFaultedPeriods.toString()
    );

    assert.fieldEquals(
      "Provider",
      providerId,
      "totalFaultedPeriods",
      expectedFaultedPeriods.toString()
    );
    assert.fieldEquals("Provider", providerId, "totalProvingPeriods", "2");
  });

  test("Test 4: Proof submission marks period as proven", () => {
    const createBlockNumber = BigInt.fromI32(100);
    const firstProvingBlockNumber = BigInt.fromI32(150);
    const proofBlockNumber = BigInt.fromI32(370);
    const challengeEpoch = BigInt.fromI32(200);
    const leafCount = BigInt.fromI32(1000);

    const dataSetCreatedEvent = createDataSetCreatedEvent(
      SET_ID,
      PROVIDER_ADDRESS,
      CONTRACT_ADDRESS,
      LISTENER_ADDRESS,
      createBlockNumber,
      BigInt.fromI32(1000)
    );
    handleDataSetCreated(dataSetCreatedEvent);

    const firstNextProvingPeriodEvent = createNextProvingPeriodEvent(
      SET_ID,
      challengeEpoch,
      leafCount,
      CONTRACT_ADDRESS,
      firstProvingBlockNumber,
      BigInt.fromI32(1500)
    );
    handleNextProvingPeriod(firstNextProvingPeriodEvent);

    const possessionProvenEvent = createPossessionProvenEvent(
      SET_ID,
      [BigInt.fromI32(0)],
      [BigInt.fromI32(100)],
      CONTRACT_ADDRESS,
      proofBlockNumber,
      BigInt.fromI32(1800)
    );
    handlePossessionProven(possessionProvenEvent);

    const proofSetId = getProofSetId();
    const provingWindowId = Bytes.fromUTF8(SET_ID.toString() + "-1").toHex();

    assert.fieldEquals("DataSet", proofSetId, "provenThisPeriod", "true");
    assert.fieldEquals(
      "ProvingWindow",
      provingWindowId,
      "proofSubmitted",
      "true"
    );
    assert.fieldEquals(
      "ProvingWindow",
      provingWindowId,
      "proofBlockNumber",
      proofBlockNumber.toString()
    );
    assert.fieldEquals("ProvingWindow", provingWindowId, "isValid", "true");
  });

  test("Test 5: Third nextProvingPeriod with proof - 0 faulted periods", () => {
    const createBlockNumber = BigInt.fromI32(100);
    const firstProvingBlockNumber = BigInt.fromI32(150);
    const proofBlockNumber = BigInt.fromI32(370);
    const secondProvingBlockNumber = BigInt.fromI32(400);
    const challengeEpoch = BigInt.fromI32(200);
    const leafCount = BigInt.fromI32(1000);

    const dataSetCreatedEvent = createDataSetCreatedEvent(
      SET_ID,
      PROVIDER_ADDRESS,
      CONTRACT_ADDRESS,
      LISTENER_ADDRESS,
      createBlockNumber,
      BigInt.fromI32(1000)
    );
    handleDataSetCreated(dataSetCreatedEvent);

    const firstNextProvingPeriodEvent = createNextProvingPeriodEvent(
      SET_ID,
      challengeEpoch,
      leafCount,
      CONTRACT_ADDRESS,
      firstProvingBlockNumber,
      BigInt.fromI32(1500)
    );
    handleNextProvingPeriod(firstNextProvingPeriodEvent);

    const possessionProvenEvent = createPossessionProvenEvent(
      SET_ID,
      [BigInt.fromI32(0)],
      [BigInt.fromI32(100)],
      CONTRACT_ADDRESS,
      proofBlockNumber,
      BigInt.fromI32(1800)
    );
    handlePossessionProven(possessionProvenEvent);

    const secondNextProvingPeriodEvent = createNextProvingPeriodEvent(
      SET_ID,
      challengeEpoch.plus(BigInt.fromI32(100)),
      leafCount,
      CONTRACT_ADDRESS,
      secondProvingBlockNumber,
      BigInt.fromI32(2000)
    );
    handleNextProvingPeriod(secondNextProvingPeriodEvent);

    const proofSetId = getProofSetId();
    const providerId = getProviderId();

    const firstDeadline = firstProvingBlockNumber.plus(MAX_PROVING_PERIOD);
    const periodsSkipped = secondProvingBlockNumber
      .minus(firstDeadline.plus(BigInt.fromI32(1)))
      .div(MAX_PROVING_PERIOD);

    assert.fieldEquals("DataSet", proofSetId, "currentDeadlineCount", "2");
    assert.fieldEquals("DataSet", proofSetId, "provenThisPeriod", "false");
    assert.fieldEquals(
      "DataSet",
      proofSetId,
      "totalFaultedPeriods",
      periodsSkipped.toString()
    );

    assert.fieldEquals(
      "Provider",
      providerId,
      "totalFaultedPeriods",
      periodsSkipped.toString()
    );
    assert.fieldEquals("Provider", providerId, "totalProvingPeriods", "2");
  });

  test("Test 6: Multiple periods skipped - calculates correct faulted periods", () => {
    const createBlockNumber = BigInt.fromI32(100);
    const firstProvingBlockNumber = BigInt.fromI32(150);
    const secondProvingBlockNumber = BigInt.fromI32(900);
    const challengeEpoch = BigInt.fromI32(200);
    const leafCount = BigInt.fromI32(1000);

    const dataSetCreatedEvent = createDataSetCreatedEvent(
      SET_ID,
      PROVIDER_ADDRESS,
      CONTRACT_ADDRESS,
      LISTENER_ADDRESS,
      createBlockNumber,
      BigInt.fromI32(1000)
    );
    handleDataSetCreated(dataSetCreatedEvent);

    const firstNextProvingPeriodEvent = createNextProvingPeriodEvent(
      SET_ID,
      challengeEpoch,
      leafCount,
      CONTRACT_ADDRESS,
      firstProvingBlockNumber,
      BigInt.fromI32(1500)
    );
    handleNextProvingPeriod(firstNextProvingPeriodEvent);

    const firstDeadline = firstProvingBlockNumber.plus(MAX_PROVING_PERIOD);

    const secondNextProvingPeriodEvent = createNextProvingPeriodEvent(
      SET_ID,
      challengeEpoch.plus(BigInt.fromI32(100)),
      leafCount,
      CONTRACT_ADDRESS,
      secondProvingBlockNumber,
      BigInt.fromI32(3000)
    );
    handleNextProvingPeriod(secondNextProvingPeriodEvent);

    const proofSetId = getProofSetId();
    const providerId = getProviderId();

    const periodsSkipped = secondProvingBlockNumber
      .minus(firstDeadline.plus(BigInt.fromI32(1)))
      .div(MAX_PROVING_PERIOD);
    const expectedFaultedPeriods = periodsSkipped.plus(BigInt.fromI32(1));
    const expectedDeadlineCount = periodsSkipped.plus(BigInt.fromI32(2));
    const expectedNextDeadline = firstDeadline.plus(
      MAX_PROVING_PERIOD.times(periodsSkipped.plus(BigInt.fromI32(1)))
    );

    assert.fieldEquals(
      "DataSet",
      proofSetId,
      "nextDeadline",
      expectedNextDeadline.toString()
    );
    assert.fieldEquals(
      "DataSet",
      proofSetId,
      "currentDeadlineCount",
      expectedDeadlineCount.toString()
    );
    assert.fieldEquals(
      "DataSet",
      proofSetId,
      "totalFaultedPeriods",
      expectedFaultedPeriods.toString()
    );

    assert.fieldEquals(
      "Provider",
      providerId,
      "totalFaultedPeriods",
      expectedFaultedPeriods.toString()
    );
    assert.fieldEquals(
      "Provider",
      providerId,
      "totalProvingPeriods",
      expectedDeadlineCount.toString()
    );
  });

  test("Test 7: nextProvingPeriod called before deadline - 0 periods skipped", () => {
    const createBlockNumber = BigInt.fromI32(100);
    const firstProvingBlockNumber = BigInt.fromI32(150);
    const secondProvingBlockNumber = BigInt.fromI32(380);
    const challengeEpoch = BigInt.fromI32(200);
    const leafCount = BigInt.fromI32(1000);

    const dataSetCreatedEvent = createDataSetCreatedEvent(
      SET_ID,
      PROVIDER_ADDRESS,
      CONTRACT_ADDRESS,
      LISTENER_ADDRESS,
      createBlockNumber,
      BigInt.fromI32(1000)
    );
    handleDataSetCreated(dataSetCreatedEvent);

    const firstNextProvingPeriodEvent = createNextProvingPeriodEvent(
      SET_ID,
      challengeEpoch,
      leafCount,
      CONTRACT_ADDRESS,
      firstProvingBlockNumber,
      BigInt.fromI32(1500)
    );
    handleNextProvingPeriod(firstNextProvingPeriodEvent);

    const firstDeadline = firstProvingBlockNumber.plus(MAX_PROVING_PERIOD);

    const secondNextProvingPeriodEvent = createNextProvingPeriodEvent(
      SET_ID,
      challengeEpoch.plus(BigInt.fromI32(100)),
      leafCount,
      CONTRACT_ADDRESS,
      secondProvingBlockNumber,
      BigInt.fromI32(2000)
    );
    handleNextProvingPeriod(secondNextProvingPeriodEvent);

    const proofSetId = getProofSetId();
    const providerId = getProviderId();

    const periodsSkipped = BigInt.fromI32(0);
    const expectedFaultedPeriods = BigInt.fromI32(1);
    const expectedNextDeadline = firstDeadline.plus(MAX_PROVING_PERIOD);

    assert.fieldEquals(
      "DataSet",
      proofSetId,
      "nextDeadline",
      expectedNextDeadline.toString()
    );
    assert.fieldEquals("DataSet", proofSetId, "currentDeadlineCount", "2");
    assert.fieldEquals(
      "DataSet",
      proofSetId,
      "totalFaultedPeriods",
      expectedFaultedPeriods.toString()
    );

    assert.fieldEquals(
      "Provider",
      providerId,
      "totalFaultedPeriods",
      expectedFaultedPeriods.toString()
    );
    assert.fieldEquals("Provider", providerId, "totalProvingPeriods", "2");
  });

  test("Test 8: nextProvingPeriod called exactly at deadline - 1 faulted period", () => {
    const createBlockNumber = BigInt.fromI32(100);
    const firstProvingBlockNumber = BigInt.fromI32(150);
    const secondProvingBlockNumber = BigInt.fromI32(390);
    const challengeEpoch = BigInt.fromI32(200);
    const leafCount = BigInt.fromI32(1000);

    const dataSetCreatedEvent = createDataSetCreatedEvent(
      SET_ID,
      PROVIDER_ADDRESS,
      CONTRACT_ADDRESS,
      LISTENER_ADDRESS,
      createBlockNumber,
      BigInt.fromI32(1000)
    );
    handleDataSetCreated(dataSetCreatedEvent);

    const firstNextProvingPeriodEvent = createNextProvingPeriodEvent(
      SET_ID,
      challengeEpoch,
      leafCount,
      CONTRACT_ADDRESS,
      firstProvingBlockNumber,
      BigInt.fromI32(1500)
    );
    handleNextProvingPeriod(firstNextProvingPeriodEvent);

    const firstDeadline = firstProvingBlockNumber.plus(MAX_PROVING_PERIOD);

    const secondNextProvingPeriodEvent = createNextProvingPeriodEvent(
      SET_ID,
      challengeEpoch.plus(BigInt.fromI32(100)),
      leafCount,
      CONTRACT_ADDRESS,
      secondProvingBlockNumber,
      BigInt.fromI32(2000)
    );
    handleNextProvingPeriod(secondNextProvingPeriodEvent);

    const proofSetId = getProofSetId();
    const providerId = getProviderId();

    const periodsSkipped = BigInt.fromI32(0);
    const expectedFaultedPeriods = BigInt.fromI32(1);
    const expectedNextDeadline = firstDeadline.plus(MAX_PROVING_PERIOD);

    assert.fieldEquals(
      "DataSet",
      proofSetId,
      "nextDeadline",
      expectedNextDeadline.toString()
    );
    assert.fieldEquals("DataSet", proofSetId, "currentDeadlineCount", "2");
    assert.fieldEquals(
      "DataSet",
      proofSetId,
      "totalFaultedPeriods",
      expectedFaultedPeriods.toString()
    );

    assert.fieldEquals(
      "Provider",
      providerId,
      "totalFaultedPeriods",
      expectedFaultedPeriods.toString()
    );
    assert.fieldEquals("Provider", providerId, "totalProvingPeriods", "2");
  });

  test("Test 9: Complex scenario - multiple proving periods with mixed proof submissions", () => {
    const createBlockNumber = BigInt.fromI32(100);
    const firstProvingBlockNumber = BigInt.fromI32(150);
    const proofBlockNumber1 = BigInt.fromI32(370);
    const secondProvingBlockNumber = BigInt.fromI32(400);
    const thirdProvingBlockNumber = BigInt.fromI32(650);
    const proofBlockNumber2 = BigInt.fromI32(870);
    const fourthProvingBlockNumber = BigInt.fromI32(900);
    const challengeEpoch = BigInt.fromI32(200);
    const leafCount = BigInt.fromI32(1000);

    const dataSetCreatedEvent = createDataSetCreatedEvent(
      SET_ID,
      PROVIDER_ADDRESS,
      CONTRACT_ADDRESS,
      LISTENER_ADDRESS,
      createBlockNumber,
      BigInt.fromI32(1000)
    );
    handleDataSetCreated(dataSetCreatedEvent);

    const firstNextProvingPeriodEvent = createNextProvingPeriodEvent(
      SET_ID,
      challengeEpoch,
      leafCount,
      CONTRACT_ADDRESS,
      firstProvingBlockNumber,
      BigInt.fromI32(1500)
    );
    handleNextProvingPeriod(firstNextProvingPeriodEvent);

    const possessionProvenEvent1 = createPossessionProvenEvent(
      SET_ID,
      [BigInt.fromI32(0)],
      [BigInt.fromI32(100)],
      CONTRACT_ADDRESS,
      proofBlockNumber1,
      BigInt.fromI32(1800)
    );
    handlePossessionProven(possessionProvenEvent1);

    const secondNextProvingPeriodEvent = createNextProvingPeriodEvent(
      SET_ID,
      challengeEpoch.plus(BigInt.fromI32(100)),
      leafCount,
      CONTRACT_ADDRESS,
      secondProvingBlockNumber,
      BigInt.fromI32(2000)
    );
    handleNextProvingPeriod(secondNextProvingPeriodEvent);

    const thirdNextProvingPeriodEvent = createNextProvingPeriodEvent(
      SET_ID,
      challengeEpoch.plus(BigInt.fromI32(200)),
      leafCount,
      CONTRACT_ADDRESS,
      thirdProvingBlockNumber,
      BigInt.fromI32(2500)
    );
    handleNextProvingPeriod(thirdNextProvingPeriodEvent);

    const possessionProvenEvent2 = createPossessionProvenEvent(
      SET_ID,
      [BigInt.fromI32(0)],
      [BigInt.fromI32(100)],
      CONTRACT_ADDRESS,
      proofBlockNumber2,
      BigInt.fromI32(3000)
    );
    handlePossessionProven(possessionProvenEvent2);

    const fourthNextProvingPeriodEvent = createNextProvingPeriodEvent(
      SET_ID,
      challengeEpoch.plus(BigInt.fromI32(300)),
      leafCount,
      CONTRACT_ADDRESS,
      fourthProvingBlockNumber,
      BigInt.fromI32(3500)
    );
    handleNextProvingPeriod(fourthNextProvingPeriodEvent);

    const proofSetId = getProofSetId();
    const providerId = getProviderId();

    const expectedTotalFaultedPeriods = BigInt.fromI32(1);

    assert.fieldEquals("DataSet", proofSetId, "currentDeadlineCount", "4");
    assert.fieldEquals(
      "DataSet",
      proofSetId,
      "totalFaultedPeriods",
      expectedTotalFaultedPeriods.toString()
    );

    assert.fieldEquals(
      "Provider",
      providerId,
      "totalFaultedPeriods",
      expectedTotalFaultedPeriods.toString()
    );
    assert.fieldEquals("Provider", providerId, "totalProvingPeriods", "4");
  });
});
