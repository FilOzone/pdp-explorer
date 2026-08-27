import { BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts";
import { DataSet, EventLog, Provider, Root, Service } from "../../generated/schema";
import { LeafSize } from "../../utils";
import { unpaddedSize, validateCommPv2 } from "../../utils/cid";
import { saveNetworkMetrics, saveProofSetMetrics, saveProviderMetrics } from "../helper";
import { SumTree } from "../sumTree";
import { DataSetStatus } from "../types";
import { getEventLogEntityId, getRootEntityId, getTransactionEntityId } from "./keys";

// Shared by handlePiecesAdded and handlePiecesAddedV2: records the EventLog row for a piece addition.
export function createPiecesAddedEventLog(
  setId: BigInt,
  pieceIds: BigInt[],
  proofSetEntityId: Bytes,
  event: ethereum.Event,
): void {
  const eventLogEntityId = getEventLogEntityId(event.transaction.hash, event.logIndex);

  const eventLog = new EventLog(eventLogEntityId);
  eventLog.setId = setId;
  eventLog.address = event.address;
  eventLog.name = "piecesAdded";
  // Store simple representation of event params
  const pieceIdStrings: string[] = [];
  for (let i = 0; i < pieceIds.length; i++) {
    pieceIdStrings.push(pieceIds[i].toString());
  }
  eventLog.data = `{ "setId": "${setId.toString()}", "pieceIds": [${pieceIdStrings.join(",")}] }`;
  eventLog.logIndex = event.logIndex;
  eventLog.transactionHash = event.transaction.hash;
  eventLog.createdAt = event.block.timestamp;
  eventLog.blockNumber = event.block.number;
  eventLog.proofSet = proofSetEntityId;
  // Match the transaction ID used by both piece-added handlers.
  eventLog.transaction = getTransactionEntityId(event.transaction.hash, setId, "addPieces");
  eventLog.save();
}

// Shared by handlePiecesAdded and handlePiecesAddedV2: creates the Root entity for one added piece and
// updates the SumTree. Returns null (and logs) if the Root already exists, so the caller can skip it
// when accumulating counts/sizes.
export function createRootForPieceCid(
  setId: BigInt,
  rootId: BigInt,
  pieceCidBytes: Bytes,
  proofSetEntityId: Bytes,
  blockTimestamp: BigInt,
  blockNumber: BigInt,
): BigInt | null {
  const commPData = validateCommPv2(pieceCidBytes);
  const rawSize = commPData.isValid ? unpaddedSize(commPData.padding, commPData.height) : BigInt.zero();

  const rootEntityId = getRootEntityId(setId, rootId);

  let root = Root.load(rootEntityId);
  if (root) {
    log.warning("createRootForPieceCid: Root {} for Set {} already exists. This shouldn't happen. Skipping.", [
      rootId.toString(),
      setId.toString(),
    ]);
    return null;
  }

  root = new Root(rootEntityId);
  root.rootId = rootId;
  root.setId = setId;
  root.rawSize = rawSize; // Use correct field name
  root.leafCount = rawSize.div(BigInt.fromI32(LeafSize));
  root.cid = pieceCidBytes; // Use correct field name
  root.removed = false; // Explicitly set removed to false
  root.lastProvenEpoch = BigInt.fromI32(0);
  root.lastProvenAt = BigInt.fromI32(0);
  root.lastFaultedEpoch = BigInt.fromI32(0);
  root.lastFaultedAt = BigInt.fromI32(0);
  root.totalProofsSubmitted = BigInt.fromI32(0);
  root.totalPeriodsFaulted = BigInt.fromI32(0);
  root.createdAt = blockTimestamp;
  root.updatedAt = blockTimestamp;
  root.blockNumber = blockNumber;
  root.proofSet = proofSetEntityId; // Link to DataSet

  root.save();

  // Update SumTree
  const sumTree = new SumTree();
  sumTree.sumTreeAdd(setId.toI32(), rawSize.div(BigInt.fromI32(LeafSize)), rootId.toI32());

  return rawSize;
}

// Shared by handlePiecesAdded and handlePiecesAddedV2: rolls the pieces created by
// createRootForPieceCid up into DataSet/Provider/Service aggregates and network/activity metrics.
export function finalizeDataSetPiecesAdded(
  proofSet: DataSet,
  providerAddr: Bytes,
  proofSetEntityId: Bytes,
  setId: BigInt,
  addedRootCount: i32,
  totalDataSizeAdded: BigInt,
  blockTimestamp: BigInt,
  blockNumber: BigInt,
  transactionCreated: boolean,
): void {
  // Update DataSet stats
  const previousDataSize = proofSet.totalDataSize;
  if (previousDataSize.equals(BigInt.zero())) {
    // First piece added, mark as ready for proving
    // status will change to PROVING in nextProvingPeriod call
    proofSet.status = DataSetStatus.READY;
  }
  proofSet.totalRoots = proofSet.totalRoots.plus(BigInt.fromI32(addedRootCount));
  proofSet.nextPieceId = proofSet.nextPieceId.plus(BigInt.fromI32(addedRootCount));
  proofSet.totalDataSize = proofSet.totalDataSize.plus(totalDataSizeAdded);
  proofSet.leafCount = proofSet.leafCount.plus(totalDataSizeAdded.div(BigInt.fromI32(LeafSize)));
  if (transactionCreated) {
    proofSet.totalTransactions = proofSet.totalTransactions.plus(BigInt.fromI32(1));
  }
  proofSet.totalEventLogs = proofSet.totalEventLogs.plus(BigInt.fromI32(1));
  proofSet.updatedAt = blockTimestamp;
  proofSet.blockNumber = blockNumber;
  proofSet.save();

  // Update Provider stats
  const provider = Provider.load(providerAddr);
  if (provider) {
    provider.totalDataSize = provider.totalDataSize.plus(totalDataSizeAdded);
    provider.totalRoots = provider.totalRoots.plus(BigInt.fromI32(addedRootCount));
    provider.updatedAt = blockTimestamp;
    provider.blockNumber = blockNumber;
    provider.save();
  } else {
    log.warning("finalizeDataSetPiecesAdded: Provider {} for DataSet {} not found", [
      providerAddr.toHex(),
      setId.toString(),
    ]);
  }

  // update Service stats
  const service = Service.load(proofSet.listener);
  if (service) {
    service.totalRoots = service.totalRoots.plus(BigInt.fromI32(addedRootCount));
    service.totalDataSize = service.totalDataSize.plus(totalDataSizeAdded);
    service.updatedAt = blockNumber;
    service.save();
  }

  // Update network metrics
  saveNetworkMetrics(
    ["totalRoots", "totalActiveRoots", "totalDataSize"],
    [BigInt.fromI32(addedRootCount), BigInt.fromI32(addedRootCount), totalDataSizeAdded],
    ["add", "add", "add"],
  );

  // update provider and proof set metrics
  const weekId = blockTimestamp.toI32() / 604800;
  const monthId = blockTimestamp.toI32() / 2592000;
  const weeklyProviderId = Bytes.fromI32(weekId).concat(providerAddr);
  const monthlyProviderId = Bytes.fromI32(monthId).concat(providerAddr);
  const weeklyProofSetId = Bytes.fromI32(weekId).concat(proofSetEntityId);
  const monthlyProofSetId = Bytes.fromI32(monthId).concat(proofSetEntityId);
  saveProviderMetrics(
    "WeeklyProviderActivity",
    weeklyProviderId,
    providerAddr,
    ["totalRootsAdded", "totalDataSizeAdded"],
    [BigInt.fromI32(addedRootCount), totalDataSizeAdded],
    ["add", "add"],
  );
  saveProviderMetrics(
    "MonthlyProviderActivity",
    monthlyProviderId,
    providerAddr,
    ["totalRootsAdded", "totalDataSizeAdded"],
    [BigInt.fromI32(addedRootCount), totalDataSizeAdded],
    ["add", "add"],
  );
  saveProofSetMetrics(
    "WeeklyProofSetActivity",
    weeklyProofSetId,
    setId,
    ["totalRootsAdded", "totalDataSizeAdded"],
    [BigInt.fromI32(addedRootCount), totalDataSizeAdded],
    ["add", "add"],
  );
  saveProofSetMetrics(
    "MonthlyProofSetActivity",
    monthlyProofSetId,
    setId,
    ["totalRootsAdded", "totalDataSizeAdded"],
    [BigInt.fromI32(addedRootCount), totalDataSizeAdded],
    ["add", "add"],
  );
}
