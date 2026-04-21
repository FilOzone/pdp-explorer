import {
  assert,
  describe,
  test,
  clearStore,
  beforeEach,
} from "matchstick-as/assembly/index";
import { BigInt, Address, Bytes } from "@graphprotocol/graph-ts";
import {
  handleDataSetCreated,
  handlePiecesAdded,
  getRootEntityId,
} from "../src/pdp-verifier";
import {
  handleFwssDataSetCreated,
  handleFwssPieceAdded,
  handleFwssServiceTerminated,
  handleFwssPdpPaymentTerminated,
  handleFwssDataSetServiceProviderChanged,
} from "../src/fwss";
import {
  createDataSetCreatedEvent,
  createRootsAddedEvent,
} from "./pdp-verifier-utils";
import {
  createFwssDataSetCreatedEvent,
  createFwssPieceAddedEvent,
  createFwssServiceTerminatedEvent,
  createFwssPdpPaymentTerminatedEvent,
  createFwssDataSetServiceProviderChangedEvent,
} from "./fwss-utils";

const SET_ID = BigInt.fromI32(1);
const PROVIDER_ID = BigInt.fromI32(42);
const PDP_RAIL_ID = BigInt.fromI32(99);
const ROOT_ID = BigInt.fromI32(101);
const PROVIDER_ADDRESS = Address.fromString(
  "0xa16081f360e3847006db660bae1c6d1b2e17ec2a"
);
const PAYER_ADDRESS = Address.fromString(
  "0xb16081f360e3847006db660bae1c6d1b2e17ec2b"
);
const NEW_PROVIDER_ADDRESS = Address.fromString(
  "0xc16081f360e3847006db660bae1c6d1b2e17ec2c"
);
const CONTRACT_ADDRESS = Address.fromString(
  "0xd16081f360e3847006db660bae1c6d1b2e17ec2d"
);

const PROOF_SET_ENTITY_ID = Bytes.fromByteArray(Bytes.fromBigInt(SET_ID));

function seedDataSet(): void {
  let ev = createDataSetCreatedEvent(
    SET_ID,
    PROVIDER_ADDRESS,
    Bytes.fromI32(0),
    CONTRACT_ADDRESS
  );
  handleDataSetCreated(ev);
}

function seedRoot(): void {
  let ev = createRootsAddedEvent(
    SET_ID,
    [ROOT_ID],
    PROVIDER_ADDRESS,
    CONTRACT_ADDRESS
  );
  handlePiecesAdded(ev);
}

describe("FWSS handlers", () => {
  beforeEach(() => {
    clearStore();
  });

  // -- handleFwssDataSetCreated -------------------------------------------

  test("PDPVerifier-created DataSet has default FWSS fields", () => {
    seedDataSet();
    assert.fieldEquals(
      "DataSet",
      PROOF_SET_ENTITY_ID.toHexString(),
      "withIPFSIndexing",
      "false"
    );
    assert.fieldEquals(
      "DataSet",
      PROOF_SET_ENTITY_ID.toHexString(),
      "withCDN",
      "false"
    );
    assert.fieldEquals(
      "DataSet",
      PROOF_SET_ENTITY_ID.toHexString(),
      "metadataKeys",
      "[]"
    );
    assert.fieldEquals(
      "DataSet",
      PROOF_SET_ENTITY_ID.toHexString(),
      "metadataValues",
      "[]"
    );
  });

  test("handleFwssDataSetCreated populates FWSS fields and derives withIPFSIndexing", () => {
    seedDataSet();
    let ev = createFwssDataSetCreatedEvent(
      SET_ID,
      PROVIDER_ID,
      PDP_RAIL_ID,
      PAYER_ADDRESS,
      PROVIDER_ADDRESS,
      ["source", "withIPFSIndexing", "withCDN"],
      ["filecoin-pin", "", "true"]
    );
    handleFwssDataSetCreated(ev);

    assert.fieldEquals(
      "DataSet",
      PROOF_SET_ENTITY_ID.toHexString(),
      "fwssProviderId",
      PROVIDER_ID.toString()
    );
    assert.fieldEquals(
      "DataSet",
      PROOF_SET_ENTITY_ID.toHexString(),
      "fwssPayer",
      PAYER_ADDRESS.toHexString()
    );
    assert.fieldEquals(
      "DataSet",
      PROOF_SET_ENTITY_ID.toHexString(),
      "fwssServiceProvider",
      PROVIDER_ADDRESS.toHexString()
    );
    assert.fieldEquals(
      "DataSet",
      PROOF_SET_ENTITY_ID.toHexString(),
      "fwssPdpRailId",
      PDP_RAIL_ID.toString()
    );
    assert.fieldEquals(
      "DataSet",
      PROOF_SET_ENTITY_ID.toHexString(),
      "withIPFSIndexing",
      "true"
    );
    assert.fieldEquals(
      "DataSet",
      PROOF_SET_ENTITY_ID.toHexString(),
      "withCDN",
      "true"
    );
  });

  test("handleFwssDataSetCreated leaves booleans false when keys absent", () => {
    seedDataSet();
    let ev = createFwssDataSetCreatedEvent(
      SET_ID,
      PROVIDER_ID,
      PDP_RAIL_ID,
      PAYER_ADDRESS,
      PROVIDER_ADDRESS,
      ["source"],
      ["filecoin-pin"]
    );
    handleFwssDataSetCreated(ev);

    assert.fieldEquals(
      "DataSet",
      PROOF_SET_ENTITY_ID.toHexString(),
      "withIPFSIndexing",
      "false"
    );
    assert.fieldEquals(
      "DataSet",
      PROOF_SET_ENTITY_ID.toHexString(),
      "withCDN",
      "false"
    );
  });

  test("handleFwssDataSetCreated creates a stub when DataSet doesn't exist yet", () => {
    // FWSS.DataSetCreated fires BEFORE PDPVerifier.DataSetCreated in the same
    // tx (see PDPVerifier._createDataSet). When our handler runs first, it
    // must create a stub with FWSS fields set so the later PDPVerifier handler
    // can load it instead of overwriting.
    const UNSEEN_SET_ID = BigInt.fromI32(999);
    const unseenEntityId = Bytes.fromByteArray(
      Bytes.fromBigInt(UNSEEN_SET_ID)
    ).toHexString();

    let ev = createFwssDataSetCreatedEvent(
      UNSEEN_SET_ID,
      PROVIDER_ID,
      PDP_RAIL_ID,
      PAYER_ADDRESS,
      PROVIDER_ADDRESS,
      ["withIPFSIndexing"],
      [""]
    );
    handleFwssDataSetCreated(ev);

    // Stub was created with FWSS fields populated.
    assert.fieldEquals("DataSet", unseenEntityId, "setId", "999");
    assert.fieldEquals("DataSet", unseenEntityId, "fwssPayer", PAYER_ADDRESS.toHexString());
    assert.fieldEquals("DataSet", unseenEntityId, "withIPFSIndexing", "true");
    // Placeholder owner/listener set by the FWSS handler (pdp-verifier will
    // overwrite when it runs later in the same block).
    assert.fieldEquals("DataSet", unseenEntityId, "owner", PROVIDER_ADDRESS.toHexString());
  });

  test("FWSS-then-PDPVerifier ordering preserves both field groups", () => {
    // Simulates real on-chain ordering: FWSS.DataSetCreated fires before
    // PDPVerifier.DataSetCreated. After both handlers run, FWSS and
    // PDPVerifier fields must both be populated correctly.
    let fwssEv = createFwssDataSetCreatedEvent(
      SET_ID,
      PROVIDER_ID,
      PDP_RAIL_ID,
      PAYER_ADDRESS,
      PROVIDER_ADDRESS,
      ["withIPFSIndexing", "withCDN"],
      ["", "true"]
    );
    handleFwssDataSetCreated(fwssEv);

    // Then PDPVerifier fires, which must load the stub (not overwrite it).
    let pdpEv = createDataSetCreatedEvent(
      SET_ID,
      PROVIDER_ADDRESS,
      Bytes.fromI32(0),
      CONTRACT_ADDRESS
    );
    handleDataSetCreated(pdpEv);

    // FWSS fields preserved
    assert.fieldEquals(
      "DataSet",
      PROOF_SET_ENTITY_ID.toHexString(),
      "fwssProviderId",
      PROVIDER_ID.toString()
    );
    assert.fieldEquals(
      "DataSet",
      PROOF_SET_ENTITY_ID.toHexString(),
      "withIPFSIndexing",
      "true"
    );
    assert.fieldEquals(
      "DataSet",
      PROOF_SET_ENTITY_ID.toHexString(),
      "withCDN",
      "true"
    );
    // PDPVerifier fields set
    assert.fieldEquals(
      "DataSet",
      PROOF_SET_ENTITY_ID.toHexString(),
      "setId",
      SET_ID.toString()
    );
    assert.fieldEquals(
      "DataSet",
      PROOF_SET_ENTITY_ID.toHexString(),
      "isActive",
      "true"
    );
    assert.fieldEquals(
      "DataSet",
      PROOF_SET_ENTITY_ID.toHexString(),
      "status",
      "EMPTY"
    );
  });

  // -- handleFwssPieceAdded -----------------------------------------------

  test("PDPVerifier-created Root has default FWSS fields", () => {
    seedDataSet();
    seedRoot();
    const rootId = getRootEntityId(SET_ID, ROOT_ID).toHexString();
    assert.fieldEquals("Root", rootId, "metadataKeys", "[]");
    assert.fieldEquals("Root", rootId, "metadataValues", "[]");
  });

  test("handleFwssPieceAdded extracts ipfsRootCID", () => {
    seedDataSet();
    seedRoot();
    let ev = createFwssPieceAddedEvent(
      SET_ID,
      ROOT_ID,
      Bytes.fromHexString("0xdeadbeef"),
      ["ipfsRootCID"],
      ["bafybeiexamplecid"]
    );
    handleFwssPieceAdded(ev);

    const rootId = getRootEntityId(SET_ID, ROOT_ID).toHexString();
    assert.fieldEquals("Root", rootId, "ipfsRootCID", "bafybeiexamplecid");
  });

  test("handleFwssPieceAdded leaves ipfsRootCID null when absent", () => {
    seedDataSet();
    seedRoot();
    let ev = createFwssPieceAddedEvent(
      SET_ID,
      ROOT_ID,
      Bytes.fromHexString("0xdeadbeef"),
      [],
      []
    );
    handleFwssPieceAdded(ev);

    // When a nullable field has no value, matchstick's fieldEquals with "null"
    // matches. Verify no crash and empty arrays persist.
    const rootId = getRootEntityId(SET_ID, ROOT_ID).toHexString();
    assert.fieldEquals("Root", rootId, "metadataKeys", "[]");
  });

  test("handleFwssPieceAdded no-ops for unknown pieceId", () => {
    seedDataSet();
    // no seedRoot — root doesn't exist
    let ev = createFwssPieceAddedEvent(
      SET_ID,
      BigInt.fromI32(999),
      Bytes.fromHexString("0xdeadbeef"),
      ["ipfsRootCID"],
      ["bafybeinope"]
    );
    handleFwssPieceAdded(ev);

    const rootId = getRootEntityId(SET_ID, BigInt.fromI32(999)).toHexString();
    assert.notInStore("Root", rootId);
  });

  // -- handleFwssServiceTerminated ----------------------------------------

  test("handleFwssServiceTerminated flips isActive to false", () => {
    seedDataSet();
    assert.fieldEquals(
      "DataSet",
      PROOF_SET_ENTITY_ID.toHexString(),
      "isActive",
      "true"
    );

    let ev = createFwssServiceTerminatedEvent(SET_ID, PROVIDER_ADDRESS);
    handleFwssServiceTerminated(ev);

    assert.fieldEquals(
      "DataSet",
      PROOF_SET_ENTITY_ID.toHexString(),
      "isActive",
      "false"
    );
  });

  test("handleFwssServiceTerminated no-ops for unknown dataSetId", () => {
    let ev = createFwssServiceTerminatedEvent(
      BigInt.fromI32(999),
      PROVIDER_ADDRESS
    );
    handleFwssServiceTerminated(ev);
    assert.notInStore(
      "DataSet",
      Bytes.fromByteArray(Bytes.fromBigInt(BigInt.fromI32(999))).toHexString()
    );
  });

  // -- handleFwssPdpPaymentTerminated -------------------------------------

  test("handleFwssPdpPaymentTerminated stores endEpoch and leaves isActive alone", () => {
    seedDataSet();
    let ev = createFwssPdpPaymentTerminatedEvent(
      SET_ID,
      BigInt.fromI32(12345),
      PDP_RAIL_ID
    );
    handleFwssPdpPaymentTerminated(ev);

    assert.fieldEquals(
      "DataSet",
      PROOF_SET_ENTITY_ID.toHexString(),
      "pdpPaymentEndEpoch",
      "12345"
    );
    assert.fieldEquals(
      "DataSet",
      PROOF_SET_ENTITY_ID.toHexString(),
      "isActive",
      "true"
    );
  });

  test("handleFwssPdpPaymentTerminated no-ops for unknown dataSetId", () => {
    let ev = createFwssPdpPaymentTerminatedEvent(
      BigInt.fromI32(999),
      BigInt.fromI32(12345),
      PDP_RAIL_ID
    );
    handleFwssPdpPaymentTerminated(ev);
    assert.notInStore(
      "DataSet",
      Bytes.fromByteArray(Bytes.fromBigInt(BigInt.fromI32(999))).toHexString()
    );
  });

  // -- handleFwssDataSetServiceProviderChanged ----------------------------

  test("handleFwssDataSetServiceProviderChanged updates fwssServiceProvider", () => {
    seedDataSet();
    // seed with FWSS initial state
    handleFwssDataSetCreated(
      createFwssDataSetCreatedEvent(
        SET_ID,
        PROVIDER_ID,
        PDP_RAIL_ID,
        PAYER_ADDRESS,
        PROVIDER_ADDRESS,
        [],
        []
      )
    );

    let ev = createFwssDataSetServiceProviderChangedEvent(
      SET_ID,
      PROVIDER_ADDRESS,
      NEW_PROVIDER_ADDRESS
    );
    handleFwssDataSetServiceProviderChanged(ev);

    assert.fieldEquals(
      "DataSet",
      PROOF_SET_ENTITY_ID.toHexString(),
      "fwssServiceProvider",
      NEW_PROVIDER_ADDRESS.toHexString()
    );
  });

  test("handleFwssDataSetServiceProviderChanged no-ops for unknown dataSetId", () => {
    let ev = createFwssDataSetServiceProviderChangedEvent(
      BigInt.fromI32(999),
      PROVIDER_ADDRESS,
      NEW_PROVIDER_ADDRESS
    );
    handleFwssDataSetServiceProviderChanged(ev);
    assert.notInStore(
      "DataSet",
      Bytes.fromByteArray(Bytes.fromBigInt(BigInt.fromI32(999))).toHexString()
    );
  });
});
