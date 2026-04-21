import { BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import {
  DataSetCreated as DataSetCreatedEvent,
  PieceAdded as PieceAddedEvent,
  ServiceTerminated as ServiceTerminatedEvent,
  PDPPaymentTerminated as PDPPaymentTerminatedEvent,
  DataSetServiceProviderChanged as DataSetServiceProviderChangedEvent,
} from "../generated/FilecoinWarmStorageService/FilecoinWarmStorageService";
import { DataSet, Root } from "../generated/schema";
import { getRootEntityId } from "./pdp-verifier";
import { saveNetworkMetrics } from "./helper";

// ---- Helpers --------------------------------------------------------------

function getProofSetEntityId(setId: BigInt): Bytes {
  return Bytes.fromByteArray(Bytes.fromBigInt(setId));
}

function arrayContains(arr: string[], needle: string): boolean {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] == needle) return true;
  }
  return false;
}

function extractMetadataValue(
  keys: string[],
  values: string[],
  needle: string
): string | null {
  for (let i = 0; i < keys.length; i++) {
    if (keys[i] == needle) {
      return i < values.length ? values[i] : null;
    }
  }
  return null;
}

// ---- Handlers -------------------------------------------------------------

export function handleFwssDataSetCreated(event: DataSetCreatedEvent): void {
  const id = getProofSetEntityId(event.params.dataSetId);
  // FWSS.DataSetCreated fires BEFORE PDPVerifier's own DataSetCreated event
  // (see PDPVerifier._createDataSet: listener callback runs first, THEN
  // `emit DataSetCreated`). If no entity exists yet, create a stub with
  // required defaults; pdp-verifier.handleDataSetCreated will run later in
  // the same block and fill in PDPVerifier-level fields. Since handlers run
  // sequentially and atomically within a block, no GraphQL query can observe
  // that intermediate state.
  let ds = DataSet.load(id);
  if (ds == null) {
    ds = new DataSet(id);
    ds.setId = event.params.dataSetId;
    // PDPVerifier-level non-null fields — safe defaults; handleDataSetCreated
    // will overwrite shortly after in this same block.
    ds.owner = event.params.serviceProvider;
    ds.listener = event.address;
    ds.isActive = true;
    ds.leafCount = BigInt.fromI32(0);
    ds.challengeRange = BigInt.fromI32(0);
    ds.lastProvenEpoch = BigInt.fromI32(0);
    ds.nextChallengeEpoch = BigInt.fromI32(0);
    ds.firstDeadline = BigInt.fromI32(0);
    ds.maxProvingPeriod = BigInt.fromI32(0);
    ds.challengeWindowSize = BigInt.fromI32(0);
    ds.currentDeadlineCount = BigInt.fromI32(0);
    ds.nextDeadline = BigInt.fromI32(0);
    ds.provenThisPeriod = false;
    ds.totalRoots = BigInt.fromI32(0);
    ds.nextPieceId = BigInt.fromI32(0);
    ds.totalDataSize = BigInt.fromI32(0);
    ds.totalFeePaid = BigInt.fromI32(0);
    ds.totalFaultedPeriods = BigInt.fromI32(0);
    ds.totalFaultedRoots = BigInt.fromI32(0);
    ds.totalProofs = BigInt.fromI32(0);
    ds.totalProvedRoots = BigInt.fromI32(0);
    ds.totalTransactions = BigInt.fromI32(0);
    ds.totalEventLogs = BigInt.fromI32(0);
    ds.createdAt = event.block.timestamp;
    ds.blockNumber = event.block.number;
    // status: EMPTY. Imported enum value would be cleaner, but schema.graphql
    // defines the enum; matching literal is what the generated code stores.
    ds.status = "EMPTY";
  }

  ds.fwssProviderId = event.params.providerId;
  ds.fwssPayer = event.params.payer;
  ds.fwssServiceProvider = event.params.serviceProvider;
  ds.fwssPdpRailId = event.params.pdpRailId;
  ds.metadataKeys = event.params.metadataKeys;
  ds.metadataValues = event.params.metadataValues;
  ds.withIPFSIndexing = arrayContains(
    event.params.metadataKeys,
    "withIPFSIndexing"
  );
  ds.withCDN = arrayContains(event.params.metadataKeys, "withCDN");
  ds.updatedAt = event.block.timestamp;
  ds.save();
}

export function handleFwssPieceAdded(event: PieceAddedEvent): void {
  const id = getRootEntityId(event.params.dataSetId, event.params.pieceId);
  const root = Root.load(id);
  if (root == null) {
    log.warning("FWSS PieceAdded for unknown root {}-{}", [
      event.params.dataSetId.toString(),
      event.params.pieceId.toString(),
    ]);
    return;
  }

  root.metadataKeys = event.params.keys;
  root.metadataValues = event.params.values;
  root.ipfsRootCID = extractMetadataValue(
    event.params.keys,
    event.params.values,
    "ipfsRootCID"
  );
  root.updatedAt = event.block.timestamp;
  root.save();
}

export function handleFwssServiceTerminated(
  event: ServiceTerminatedEvent
): void {
  const id = getProofSetEntityId(event.params.dataSetId);
  const ds = DataSet.load(id);
  if (ds == null) {
    log.warning("FWSS ServiceTerminated for unknown dataSet {}", [
      event.params.dataSetId.toString(),
    ]);
    return;
  }

  // Guard against double-decrement of totalActiveProofSets in case both
  // DataSetDeleted (PDPVerifier) and ServiceTerminated (FWSS) fire for the
  // same dataset. Only decrement if this event is the one flipping isActive.
  if (ds.isActive) {
    saveNetworkMetrics(
      ["totalActiveProofSets"],
      [BigInt.fromI32(1)],
      ["subtract"]
    );
  }
  ds.isActive = false;
  ds.updatedAt = event.block.timestamp;
  ds.save();
}

export function handleFwssPdpPaymentTerminated(
  event: PDPPaymentTerminatedEvent
): void {
  const id = getProofSetEntityId(event.params.dataSetId);
  const ds = DataSet.load(id);
  if (ds == null) {
    log.warning("FWSS PDPPaymentTerminated for unknown dataSet {}", [
      event.params.dataSetId.toString(),
    ]);
    return;
  }

  ds.pdpPaymentEndEpoch = event.params.endEpoch;
  ds.updatedAt = event.block.timestamp;
  ds.save();
}

export function handleFwssDataSetServiceProviderChanged(
  event: DataSetServiceProviderChangedEvent
): void {
  const id = getProofSetEntityId(event.params.dataSetId);
  const ds = DataSet.load(id);
  if (ds == null) {
    log.warning("FWSS DataSetServiceProviderChanged for unknown dataSet {}", [
      event.params.dataSetId.toString(),
    ]);
    return;
  }

  ds.fwssServiceProvider = event.params.newServiceProvider;
  ds.updatedAt = event.block.timestamp;
  ds.save();
}
