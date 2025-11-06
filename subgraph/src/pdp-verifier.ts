import { BigInt, Bytes, log, store, Value } from "@graphprotocol/graph-ts";
import {
  NextProvingPeriod as NextProvingPeriodEvent,
  PossessionProven as PossessionProvenEvent,
  ProofFeePaid as ProofFeePaidEvent,
  DataSetCreated as DataSetCreatedEvent,
  DataSetDeleted as DataSetDeletedEvent,
  DataSetDeleted as DataSetEmptyEvent,
  StorageProviderChanged as StorageProviderChangedEvent,
  PiecesAdded as PiecesAddedEvent,
  PiecesRemoved as PiecesRemovedEvent,
} from "../generated/PDPVerifier/PDPVerifier";
import {
  EventLog,
  Provider,
  DataSet,
  Root,
  Transaction,
  Service,
  ServiceProviderLink,
  ProvingWindow,
} from "../generated/schema";
import {
  saveProviderMetrics,
  saveProofSetMetrics,
  saveNetworkMetrics,
} from "./helper";
import { SumTree } from "./sumTree";
import { LeafSize } from "../utils";
import { validateCommPv2, unpaddedSize } from "../utils/cid";

// --- Helper Functions for ID Generation ---
function getProofSetEntityId(setId: BigInt): Bytes {
  return Bytes.fromByteArray(Bytes.fromBigInt(setId));
}

function getRootEntityId(setId: BigInt, rootId: BigInt): Bytes {
  return Bytes.fromUTF8(setId.toString() + "-" + rootId.toString());
}

function getServiceProviderLinkEntityId(
  serviceAddr: Bytes,
  providerAddr: Bytes
): Bytes {
  return serviceAddr.concat(providerAddr);
}

function getTransactionEntityId(txHash: Bytes): Bytes {
  return txHash;
}

function getEventLogEntityId(txHash: Bytes, logIndex: BigInt): Bytes {
  return txHash.concatI32(logIndex.toI32());
}

// -----------------------------------------

export function handleDataSetCreated(event: DataSetCreatedEvent): void {
  const listenerAddr = Bytes.fromUint8Array(
    event.transaction.input.subarray(16, 36)
  );

  const proofSetEntityId = getProofSetEntityId(event.params.setId);
  const transactionEntityId = getTransactionEntityId(event.transaction.hash);
  const eventLogEntityId = getEventLogEntityId(
    event.transaction.hash,
    event.logIndex
  );
  const providerEntityId = event.params.storageProvider; // Provider ID is the owner address

  // Create Event Log
  const eventLog = new EventLog(eventLogEntityId);
  eventLog.setId = event.params.setId; // Keep raw ID for potential filtering
  eventLog.address = event.address;
  eventLog.name = "DataSetCreated";
  eventLog.data = `{"setId":"${event.params.setId.toString()}","storageProvider":"${event.params.storageProvider.toHexString()}"}`;
  eventLog.logIndex = event.logIndex;
  eventLog.transactionHash = event.transaction.hash; // Keep raw hash
  eventLog.createdAt = event.block.timestamp;
  eventLog.blockNumber = event.block.number;
  // Link entities
  eventLog.proofSet = proofSetEntityId;
  eventLog.transaction = transactionEntityId;
  eventLog.save();

  // Create Transaction
  // Check if transaction already exists (e.g., from another log in the same tx)
  let transaction = Transaction.load(transactionEntityId);
  if (transaction == null) {
    transaction = new Transaction(transactionEntityId);
    transaction.hash = event.transaction.hash;
    transaction.dataSetId = event.params.setId; // Keep raw ID for potential filtering
    transaction.height = event.block.number;
    transaction.fromAddress = event.transaction.from;
    transaction.toAddress = event.transaction.to; // Can be null for contract creation
    transaction.value = event.transaction.value;
    transaction.method = "createDataSet"; // Or derive from input data if possible
    transaction.status = true; // Assuming success if event emitted
    transaction.createdAt = event.block.timestamp;
    // Link entities
    transaction.proofSet = proofSetEntityId;
    transaction.save();
  }

  // Create DataSet
  let proofSet = new DataSet(proofSetEntityId);
  proofSet.setId = event.params.setId;
  proofSet.owner = providerEntityId; // Link to Provider via owner address (which is Provider's ID)
  proofSet.listener = listenerAddr;
  proofSet.isActive = true;
  proofSet.leafCount = BigInt.fromI32(0);
  proofSet.challengeRange = BigInt.fromI32(0);
  proofSet.lastProvenEpoch = BigInt.fromI32(0);
  proofSet.nextChallengeEpoch = BigInt.fromI32(0);
  // Initialize proving period tracking fields (will be set when first NextProvingPeriod is called)
  proofSet.firstDeadline = BigInt.fromI32(0);
  proofSet.maxProvingPeriod = BigInt.fromI32(0);
  proofSet.challengeWindowSize = BigInt.fromI32(0);
  proofSet.currentDeadlineCount = BigInt.fromI32(0);
  // Existing fields
  proofSet.totalRoots = BigInt.fromI32(0);
  proofSet.nextPieceId = BigInt.fromI32(0);
  proofSet.totalDataSize = BigInt.fromI32(0);
  proofSet.totalFeePaid = BigInt.fromI32(0);
  proofSet.totalFaultedPeriods = BigInt.fromI32(0);
  proofSet.totalFaultedRoots = BigInt.fromI32(0);
  proofSet.totalProofs = BigInt.fromI32(0);
  proofSet.totalProvedRoots = BigInt.fromI32(0);
  proofSet.totalTransactions = BigInt.fromI32(1);
  proofSet.totalEventLogs = BigInt.fromI32(1);
  proofSet.createdAt = event.block.timestamp;
  proofSet.updatedAt = event.block.timestamp;
  proofSet.blockNumber = event.block.number;
  proofSet.save();

  // network metrics variables
  let network_totalProofSets = BigInt.fromI32(1);
  let network_totalActiveProofSets = BigInt.fromI32(1);
  let network_totalProviders = BigInt.fromI32(0);
  let network_totalServices = BigInt.fromI32(0);

  // Create or Update Provider
  let provider = Provider.load(providerEntityId);
  if (provider == null) {
    provider = new Provider(providerEntityId);
    provider.address = event.params.storageProvider;
    provider.totalRoots = BigInt.fromI32(0);
    provider.totalProofSets = BigInt.fromI32(1);
    provider.totalFaultedPeriods = BigInt.fromI32(0);
    provider.totalFaultedRoots = BigInt.fromI32(0);
    provider.totalDataSize = BigInt.fromI32(0);
    provider.createdAt = event.block.timestamp;
    provider.blockNumber = event.block.number;

    // update network metrics
    network_totalProviders = BigInt.fromI32(1);
  } else {
    // Update timestamp/block even if exists
    provider.totalProofSets = provider.totalProofSets.plus(BigInt.fromI32(1));
    provider.blockNumber = event.block.number;
  }
  // provider.proofSetIds = provider.proofSetIds.concat([event.params.setId]); // REMOVED - Handled by @derivedFrom
  provider.updatedAt = event.block.timestamp;
  provider.save();

  // Store Service
  let service = Service.load(listenerAddr);
  if (service == null) {
    service = new Service(listenerAddr);
    service.address = listenerAddr;
    service.totalProofSets = BigInt.fromI32(1);
    service.totalProviders = BigInt.fromI32(0);
    service.totalRoots = BigInt.fromI32(0);
    service.totalDataSize = BigInt.fromI32(0);
    service.totalFaultedPeriods = BigInt.fromI32(0);
    service.totalFaultedRoots = BigInt.fromI32(0);
    service.createdAt = event.block.timestamp;

    network_totalServices = BigInt.fromI32(1);
  } else {
    service.totalProofSets = service.totalProofSets.plus(BigInt.fromI32(1));
  }
  service.updatedAt = event.block.timestamp;

  // Store ServiceProviderLink
  let serviceProviderLink = ServiceProviderLink.load(
    getServiceProviderLinkEntityId(listenerAddr, event.params.storageProvider)
  );
  if (serviceProviderLink == null) {
    serviceProviderLink = new ServiceProviderLink(
      getServiceProviderLinkEntityId(listenerAddr, event.params.storageProvider)
    );
    serviceProviderLink.totalProofSets = BigInt.fromI32(1);
    serviceProviderLink.service = listenerAddr;
    serviceProviderLink.provider = event.params.storageProvider;

    // update service stats
    service.totalProviders = service.totalProviders.plus(BigInt.fromI32(1));
  } else {
    serviceProviderLink.totalProofSets =
      serviceProviderLink.totalProofSets.plus(BigInt.fromI32(1));
  }
  service.save();
  serviceProviderLink.save();

  // update network metrics
  saveNetworkMetrics(
    [
      "totalProofSets",
      "totalActiveProofSets",
      "totalProviders",
      "totalServices",
    ],
    [
      network_totalProofSets,
      network_totalActiveProofSets,
      network_totalProviders,
      network_totalServices,
    ],
    ["add", "add", "add", "add"]
  );

  // update provider and proof set metrics
  const weekId = event.block.timestamp.toI32() / 604800;
  const monthId = event.block.timestamp.toI32() / 2592000;
  const weeklyProviderId = Bytes.fromI32(weekId).concat(providerEntityId);
  const monthlyProviderId = Bytes.fromI32(monthId).concat(providerEntityId);
  saveProviderMetrics(
    "WeeklyProviderActivity",
    weeklyProviderId,
    providerEntityId,
    ["totalProofSetsCreated"],
    [BigInt.fromI32(1)],
    ["add"]
  );
  saveProviderMetrics(
    "MonthlyProviderActivity",
    monthlyProviderId,
    providerEntityId,
    ["totalProofSetsCreated"],
    [BigInt.fromI32(1)],
    ["add"]
  );
}

export function handleDataSetDeleted(event: DataSetDeletedEvent): void {
  saveNetworkMetrics(
    ["totalActiveProofSets"],
    [BigInt.fromI32(1)],
    ["subtract"]
  );
  const setId = event.params.setId;
  const deletedLeafCount = event.params.deletedLeafCount;

  const proofSetEntityId = getProofSetEntityId(setId);
  const eventLogEntityId = getEventLogEntityId(
    event.transaction.hash,
    event.logIndex
  );
  const transactionEntityId = getTransactionEntityId(event.transaction.hash);

  // Create Event Log
  const eventLog = new EventLog(eventLogEntityId);
  eventLog.setId = setId;
  eventLog.address = event.address;
  eventLog.name = "DataSetDeleted";
  eventLog.data = `{"setId":"${setId.toString()}","deletedLeafCount":"${deletedLeafCount.toString()}"}`;
  eventLog.logIndex = event.logIndex;
  eventLog.transactionHash = event.transaction.hash;
  eventLog.createdAt = event.block.timestamp;
  eventLog.blockNumber = event.block.number;
  // Link entities
  eventLog.proofSet = proofSetEntityId;
  eventLog.transaction = transactionEntityId;
  eventLog.save();

  // Create Transaction if it doesn't exist
  let transaction = Transaction.load(transactionEntityId);
  if (transaction == null) {
    transaction = new Transaction(transactionEntityId);
    transaction.hash = event.transaction.hash;
    transaction.dataSetId = setId;
    transaction.height = event.block.number;
    transaction.fromAddress = event.transaction.from;
    transaction.toAddress = event.transaction.to;
    transaction.value = event.transaction.value;
    transaction.method = "deleteDataSet"; // Example method name
    transaction.status = true;
    transaction.createdAt = event.block.timestamp;
    transaction.proofSet = proofSetEntityId; // Link to DataSet
    transaction.save();
  }

  // Load DataSet
  const proofSet = DataSet.load(proofSetEntityId);
  if (!proofSet) {
    log.warning("DataSetDeleted: DataSet {} not found", [setId.toString()]);
    return;
  }

  const ownerAddress = proofSet.owner;

  // Load Provider (to update stats before changing owner)
  const provider = Provider.load(ownerAddress);
  if (provider) {
    provider.totalDataSize = provider.totalDataSize.minus(
      proofSet.totalDataSize
    );
    if (provider.totalDataSize.lt(BigInt.fromI32(0))) {
      provider.totalDataSize = BigInt.fromI32(0);
    }
    provider.totalProofSets = provider.totalProofSets.minus(BigInt.fromI32(1));
    provider.updatedAt = event.block.timestamp;
    provider.blockNumber = event.block.number;
    provider.save();
  } else {
    log.warning("DataSetDeleted: Provider {} for DataSet {} not found", [
      ownerAddress.toHexString(),
      setId.toString(),
    ]);
  }

  // Update DataSet
  proofSet.isActive = false;
  proofSet.owner = Bytes.empty();
  proofSet.totalRoots = BigInt.fromI32(0);
  proofSet.totalDataSize = BigInt.fromI32(0);
  proofSet.nextChallengeEpoch = BigInt.fromI32(0);
  proofSet.lastProvenEpoch = BigInt.fromI32(0);
  proofSet.totalTransactions = proofSet.totalTransactions.plus(
    BigInt.fromI32(1)
  );
  proofSet.totalEventLogs = proofSet.totalEventLogs.plus(BigInt.fromI32(1));
  proofSet.updatedAt = event.block.timestamp;
  proofSet.blockNumber = event.block.number;
  proofSet.save();

  // Note: Pieces associated with this DataSet are not automatically removed or updated here.
  // They still exist but are linked to an inactive DataSet.
  // Consider if Pieces should be marked as inactive or removed in handlePiecesRemoved if needed.
}

export function handleStorageProviderChanged(
  event: StorageProviderChangedEvent
): void {
  const setId = event.params.setId;
  const oldStorageProvider = event.params.oldStorageProvider;
  const newStorageProvider = event.params.newStorageProvider;

  const proofSetEntityId = getProofSetEntityId(setId);
  const eventLogEntityId = getEventLogEntityId(
    event.transaction.hash,
    event.logIndex
  );
  const transactionEntityId = getTransactionEntityId(event.transaction.hash);

  // Create Event Log
  const eventLog = new EventLog(eventLogEntityId);
  eventLog.setId = setId;
  eventLog.address = event.address;
  eventLog.name = "StorageProviderChanged";
  eventLog.data = `{"setId":"${setId.toString()}","oldStorageProvider":"${oldStorageProvider.toHexString()}","newStorageProvider":"${newStorageProvider.toHexString()}"}`;
  eventLog.logIndex = event.logIndex;
  eventLog.transactionHash = event.transaction.hash;
  eventLog.createdAt = event.block.timestamp;
  eventLog.blockNumber = event.block.number;
  // Link entities
  eventLog.proofSet = proofSetEntityId;
  eventLog.transaction = transactionEntityId;
  eventLog.save();

  // Create Transaction if it doesn't exist
  let transaction = Transaction.load(transactionEntityId);
  if (transaction == null) {
    transaction = new Transaction(transactionEntityId);
    transaction.hash = event.transaction.hash;
    transaction.dataSetId = setId;
    transaction.height = event.block.number;
    transaction.fromAddress = event.transaction.from;
    transaction.toAddress = event.transaction.to;
    transaction.value = event.transaction.value;
    transaction.method = "claimDataSetStorageProvider"; // Example method name
    transaction.status = true;
    transaction.createdAt = event.block.timestamp;
    transaction.proofSet = proofSetEntityId; // Link to DataSet
    transaction.save();
  }

  // Load DataSet
  const proofSet = DataSet.load(proofSetEntityId);
  if (!proofSet) {
    log.warning("StorageProviderChanged: DataSet {} not found", [
      setId.toString(),
    ]);
    return;
  }

  // Load Old Provider (if exists) - Just update timestamp, derived field handles removal
  const oldProvider = Provider.load(oldStorageProvider);
  if (oldProvider) {
    oldProvider.totalProofSets = oldProvider.totalProofSets.minus(
      BigInt.fromI32(1)
    );
    oldProvider.updatedAt = event.block.timestamp;
    oldProvider.blockNumber = event.block.number;
    oldProvider.save();
  } else {
    log.warning("StorageProviderChanged: Old Provider {} not found", [
      oldStorageProvider.toHexString(),
    ]);
  }

  // load old ServiceProvider link - check if totalProofSets > 1 or not
  // if not delete entity else decrease totalProofSets
  const oldServiceProviderLink = ServiceProviderLink.load(
    getServiceProviderLinkEntityId(proofSet.listener, oldStorageProvider)
  );
  if (oldServiceProviderLink) {
    if (oldServiceProviderLink.totalProofSets.gt(BigInt.fromI32(1))) {
      oldServiceProviderLink.totalProofSets =
        oldServiceProviderLink.totalProofSets.minus(BigInt.fromI32(1));
    } else {
      store.remove("ServiceProviderLink", oldServiceProviderLink.id.toString());
    }
    oldServiceProviderLink.save();
  }

  // load new ServiceProvider link
  let newServiceProviderLink = ServiceProviderLink.load(
    getServiceProviderLinkEntityId(proofSet.listener, newStorageProvider)
  );
  if (newServiceProviderLink) {
    newServiceProviderLink.totalProofSets =
      newServiceProviderLink.totalProofSets.plus(BigInt.fromI32(1));
  } else {
    newServiceProviderLink = new ServiceProviderLink(
      getServiceProviderLinkEntityId(proofSet.listener, newStorageProvider)
    );
    newServiceProviderLink.totalProofSets = BigInt.fromI32(1);
    newServiceProviderLink.service = proofSet.listener;
    newServiceProviderLink.provider = newStorageProvider;
  }
  newServiceProviderLink.save();

  // Load or Create New Provider - Just update timestamp/create, derived field handles addition
  let newProvider = Provider.load(newStorageProvider);
  if (newProvider == null) {
    // update network metrics
    saveNetworkMetrics(["totalProviders"], [BigInt.fromI32(1)], ["add"]);
    newProvider = new Provider(newStorageProvider);
    newProvider.address = newStorageProvider;
    newProvider.totalRoots = BigInt.fromI32(0);
    newProvider.totalFaultedPeriods = BigInt.fromI32(0);
    newProvider.totalFaultedRoots = BigInt.fromI32(0);
    newProvider.totalDataSize = BigInt.fromI32(0);
    newProvider.totalProofSets = BigInt.fromI32(1);
    newProvider.createdAt = event.block.timestamp;
    newProvider.blockNumber = event.block.number;
  } else {
    newProvider.totalProofSets = newProvider.totalProofSets.plus(
      BigInt.fromI32(1)
    );
    newProvider.blockNumber = event.block.number;
  }
  newProvider.updatedAt = event.block.timestamp;
  newProvider.save();

  // Update DataSet Owner (this updates the derived relationship on both old and new Provider)
  proofSet.owner = newStorageProvider; // Set owner to the new provider's ID
  proofSet.totalTransactions = proofSet.totalTransactions.plus(
    BigInt.fromI32(1)
  );
  proofSet.totalEventLogs = proofSet.totalEventLogs.plus(BigInt.fromI32(1));
  proofSet.updatedAt = event.block.timestamp;
  proofSet.blockNumber = event.block.number;
  proofSet.save();
}

export function handleProofFeePaid(event: ProofFeePaidEvent): void {
  const setId = event.params.setId;
  const fee = event.params.fee;

  // update network metrics
  saveNetworkMetrics(["totalProofFeePaidInFil"], [fee], ["add"]);

  const proofSetEntityId = getProofSetEntityId(setId);
  const eventLogEntityId = getEventLogEntityId(
    event.transaction.hash,
    event.logIndex
  );
  const transactionEntityId = getTransactionEntityId(event.transaction.hash);

  // Create Event Log
  const eventLog = new EventLog(eventLogEntityId);
  eventLog.setId = setId; // Keep raw ID
  eventLog.address = event.address;
  eventLog.name = "ProofFeePaid";
  eventLog.data = `{"dataSetId":"${setId.toString()}","fee":"${fee.toString()}"}`;
  eventLog.logIndex = event.logIndex;
  eventLog.transactionHash = event.transaction.hash;
  eventLog.createdAt = event.block.timestamp;
  eventLog.blockNumber = event.block.number;
  // Link entities
  eventLog.proofSet = proofSetEntityId;
  eventLog.transaction = transactionEntityId;
  eventLog.save();

  // Update DataSet total fee paid
  const proofSet = DataSet.load(proofSetEntityId);
  if (proofSet) {
    proofSet.totalFeePaid = proofSet.totalFeePaid.plus(fee);
    proofSet.totalEventLogs = proofSet.totalEventLogs.plus(BigInt.fromI32(1));
    proofSet.updatedAt = event.block.timestamp;
    proofSet.blockNumber = event.block.number;
    proofSet.save();
  } else {
    log.warning("ProofFeePaid: DataSet {} not found", [setId.toString()]);
  }
}

export function handleDataSetEmpty(event: DataSetEmptyEvent): void {
  const setId = event.params.setId;

  const proofSetEntityId = getProofSetEntityId(setId);
  const eventLogEntityId = getEventLogEntityId(
    event.transaction.hash,
    event.logIndex
  );
  const transactionEntityId = getTransactionEntityId(event.transaction.hash);

  // Create Event Log
  const eventLog = new EventLog(eventLogEntityId);
  eventLog.setId = setId;
  eventLog.address = event.address;
  eventLog.name = "DataSetDeleted";
  eventLog.data = `{"setId":"${setId.toString()}"}`;
  eventLog.logIndex = event.logIndex;
  eventLog.transactionHash = event.transaction.hash;
  eventLog.createdAt = event.block.timestamp;
  eventLog.blockNumber = event.block.number;
  // Link entities
  eventLog.proofSet = proofSetEntityId;
  eventLog.transaction = transactionEntityId;
  eventLog.save();

  // Update DataSet
  const proofSet = DataSet.load(proofSetEntityId);
  if (proofSet) {
    const oldTotalDataSize = proofSet.totalDataSize; // Store size before zeroing

    proofSet.totalRoots = BigInt.fromI32(0);
    proofSet.totalDataSize = BigInt.fromI32(0);
    proofSet.leafCount = BigInt.fromI32(0);
    proofSet.totalEventLogs = proofSet.totalEventLogs.plus(BigInt.fromI32(1));
    proofSet.updatedAt = event.block.timestamp;
    proofSet.blockNumber = event.block.number;
    proofSet.save();

    // Update Provider's total data size
    const provider = Provider.load(proofSet.owner);
    if (provider) {
      // Subtract the size this proof set had *before* it was zeroed
      provider.totalDataSize = provider.totalDataSize.minus(oldTotalDataSize);
      if (provider.totalDataSize.lt(BigInt.fromI32(0))) {
        provider.totalDataSize = BigInt.fromI32(0); // Prevent negative size
      }
      provider.updatedAt = event.block.timestamp;
      provider.blockNumber = event.block.number;
      provider.save();
    } else {
      // It's possible the provider was deleted or owner changed before this event
      log.warning("DataSetDeleted: Provider {} for DataSet {} not found", [
        proofSet.owner.toHexString(),
        setId.toString(),
      ]);
    }
  } else {
    log.warning("DataSetDeleted: DataSet {} not found", [setId.toString()]);
  }
  // Note: This event implies all roots are gone. Existing Root entities
  // linked to this DataSet might need to be marked as removed or deleted
  // depending on the desired data retention policy. This handler doesn't do that.
  // Consider adding logic here or in handlePiecesRemoved if needed.
}

export function handlePossessionProven(event: PossessionProvenEvent): void {
  const setId = event.params.setId;
  const challenges = event.params.challenges; // Array of { rootId: BigInt, offset: BigInt }
  const currentBlockNumber = event.block.number; // Use block number as epoch indicator
  const currentTimestamp = event.block.timestamp;

  const proofSetEntityId = getProofSetEntityId(setId);
  const eventLogEntityId = getEventLogEntityId(
    event.transaction.hash,
    event.logIndex
  );
  const transactionEntityId = getTransactionEntityId(event.transaction.hash);

  // Create Event Log (Only one per event, log all challenges)
  const eventLog = new EventLog(eventLogEntityId);
  eventLog.setId = setId;
  eventLog.address = event.address;
  eventLog.name = "PossessionProven";
  // Store challenges as a simple string representation for the log
  let challengesStr = "[";
  for (let i = 0; i < challenges.length; i++) {
    challengesStr += `{"pieceId":${challenges[i].pieceId.toString()},"offset":${challenges[i].offset.toString()}}`;
    if (i < challenges.length - 1) {
      challengesStr += ",";
    }
  }
  challengesStr += "]";
  eventLog.data = `{"setId":"${setId.toString()}","challenges":${challengesStr}}`;
  eventLog.logIndex = event.logIndex;
  eventLog.transactionHash = event.transaction.hash;
  eventLog.createdAt = currentTimestamp;
  eventLog.blockNumber = currentBlockNumber;
  // Link entities
  eventLog.proofSet = proofSetEntityId;
  eventLog.transaction = transactionEntityId;
  eventLog.save();

  // Create Transaction (if it doesn't exist)
  let transaction = Transaction.load(transactionEntityId);
  if (transaction == null) {
    transaction = new Transaction(transactionEntityId);
    transaction.hash = event.transaction.hash;
    transaction.dataSetId = setId; // Keep raw ID
    transaction.height = currentBlockNumber;
    transaction.fromAddress = event.transaction.from;
    transaction.toAddress = event.transaction.to;
    transaction.value = event.transaction.value;
    transaction.method = "provePossession"; // Example method name
    transaction.status = true;
    transaction.createdAt = currentTimestamp;
    transaction.proofSet = proofSetEntityId; // Link to DataSet
    transaction.save();
  }

  let uniqueRoots: BigInt[] = [];
  let pieceIdMap = new Map<string, boolean>();

  // Process each challenge
  for (let i = 0; i < challenges.length; i++) {
    const challenge = challenges[i];
    const pieceId = challenge.pieceId;

    const pieceIdStr = pieceId.toString();
    if (!pieceIdMap.has(pieceIdStr)) {
      uniqueRoots.push(pieceId);
      pieceIdMap.set(pieceIdStr, true);
    }
  }

  for (let i = 0; i < uniqueRoots.length; i++) {
    const rootId = uniqueRoots[i];
    const rootEntityId = getRootEntityId(setId, rootId);
    const root = Root.load(rootEntityId);
    if (root) {
      root.lastProvenEpoch = currentBlockNumber;
      root.lastProvenAt = currentTimestamp;
      root.totalProofsSubmitted = root.totalProofsSubmitted.plus(
        BigInt.fromI32(1)
      );
      root.updatedAt = currentTimestamp;
      root.blockNumber = currentBlockNumber;
      root.save();
    } else {
      log.warning(
        "PossessionProven: Root {} for Set {} not found during challenge processing",
        [rootId.toString(), setId.toString()]
      );
    }
  }

  // Update DataSet (once per event)
  const proofSet = DataSet.load(proofSetEntityId);
  if (proofSet) {
    // Check if proof is within valid proving window
    let isValidProof = false;
    let currentProvingWindow: ProvingWindow | null = null;

    // Only validate if proving period tracking is set up
    if (proofSet.firstDeadline && !proofSet.firstDeadline.equals(BigInt.fromI32(0))) {
      // Find the current proving window
      const currentBlock = currentBlockNumber;

      // Calculate which deadline period we're in
      const blocksSinceFirst = currentBlock.minus(proofSet.firstDeadline);
      const currentPeriod = blocksSinceFirst.div(proofSet.maxProvingPeriod);
      const deadlineCount = currentPeriod.plus(BigInt.fromI32(1));

      // Calculate window boundaries
      const deadline = proofSet.firstDeadline.plus(deadlineCount.times(proofSet.maxProvingPeriod));
      const windowStart = deadline.minus(proofSet.challengeWindowSize);

      isValidProof = currentBlock.ge(windowStart) && currentBlock.le(deadline);

      // Update or create proving window
      const provingWindowId = Bytes.fromUTF8(setId.toString() + "-" + deadlineCount.toString());
      currentProvingWindow = ProvingWindow.load(provingWindowId);

      if (currentProvingWindow) {
        currentProvingWindow.proofSubmitted = true;
        currentProvingWindow.proofBlockNumber = currentBlock;
        currentProvingWindow.isValid = isValidProof;
        currentProvingWindow.save();
      }

      log.info("PossessionProven validation for DataSet {}: window {}-{}, proof at {}, valid: {}", [
        setId.toString(),
        windowStart.toString(),
        deadline.toString(),
        currentBlock.toString(),
        isValidProof ? "true" : "false"
      ]);
    }

    proofSet.lastProvenEpoch = currentBlockNumber; // Update last proven epoch for the set
    proofSet.totalProvedRoots = proofSet.totalProvedRoots.plus(
      BigInt.fromI32(uniqueRoots.length)
    );
    proofSet.totalProofs = proofSet.totalProofs.plus(BigInt.fromI32(1));
    proofSet.totalTransactions = proofSet.totalTransactions.plus(
      BigInt.fromI32(1)
    );
    proofSet.totalEventLogs = proofSet.totalEventLogs.plus(BigInt.fromI32(1));
    proofSet.updatedAt = currentTimestamp;
    proofSet.blockNumber = currentBlockNumber;
    proofSet.save();

    // update provider and proof set metrics
    const weekId = currentTimestamp.toI32() / 604800;
    const monthId = currentTimestamp.toI32() / 2592000;
    const providerAddr = proofSet.owner;
    const weeklyProviderId = Bytes.fromI32(weekId).concat(providerAddr);
    const monthlyProviderId = Bytes.fromI32(monthId).concat(providerAddr);
    const weeklyProofSetId = Bytes.fromI32(weekId).concat(proofSetEntityId);
    const monthlyProofSetId = Bytes.fromI32(monthId).concat(proofSetEntityId);

    if (!isValidProof) {
      saveProviderMetrics(
        "WeeklyProviderActivity",
        weeklyProviderId,
        providerAddr,
        ["totalFaultedPeriods", "totalFaultedRoots"],
        [BigInt.fromI32(1), BigInt.fromI32(uniqueRoots.length)],
        ["add", "add"]
      );
      saveProviderMetrics(
        "MonthlyProviderActivity",
        monthlyProviderId,
        providerAddr,
        ["totalFaultedPeriods", "totalFaultedRoots"],
        [BigInt.fromI32(1), BigInt.fromI32(uniqueRoots.length)],
        ["add", "add"]
      );
      saveProofSetMetrics(
        "WeeklyProofSetActivity",
        weeklyProofSetId,
        setId,
        ["totalFaultedPeriods", "totalFaultedRoots"],
        [BigInt.fromI32(1), BigInt.fromI32(uniqueRoots.length)],
        ["add", "add"]
      );
      saveProofSetMetrics(
        "MonthlyProofSetActivity",
        monthlyProofSetId,
        setId,
        ["totalFaultedPeriods", "totalFaultedRoots"],
        [BigInt.fromI32(1), BigInt.fromI32(uniqueRoots.length)],
        ["add", "add"]
      );
    }
    saveProviderMetrics(
      "WeeklyProviderActivity",
      weeklyProviderId,
      providerAddr,
      ["totalProofs", "totalRootsProved"],
      [BigInt.fromI32(1), BigInt.fromI32(uniqueRoots.length)],
      ["add", "add"]
    );
    saveProviderMetrics(
      "MonthlyProviderActivity",
      monthlyProviderId,
      providerAddr,
      ["totalProofs", "totalRootsProved"],
      [BigInt.fromI32(1), BigInt.fromI32(uniqueRoots.length)],
      ["add", "add"]
    );
    saveProofSetMetrics(
      "WeeklyProofSetActivity",
      weeklyProofSetId,
      setId,
      ["totalProofs", "totalRootsProved"],
      [BigInt.fromI32(1), BigInt.fromI32(uniqueRoots.length)],
      ["add", "add"]
    );
    saveProofSetMetrics(
      "MonthlyProofSetActivity",
      monthlyProofSetId,
      setId,
      ["totalProofs", "totalRootsProved"],
      [BigInt.fromI32(1), BigInt.fromI32(uniqueRoots.length)],
      ["add", "add"]
    );
  } else {
    log.warning("PossessionProven: DataSet {} not found", [setId.toString()]);
  }

  // Update network metrics
  saveNetworkMetrics(
    ["totalProvedRoots", "totalProofs"],
    [BigInt.fromI32(uniqueRoots.length), BigInt.fromI32(1)],
    ["add", "add"]
  );
}

export function handleNextProvingPeriod(event: NextProvingPeriodEvent): void {
  const setId = event.params.setId;
  const challengeEpoch = event.params.challengeEpoch;
  const leafCount = event.params.leafCount;

  const proofSetEntityId = getProofSetEntityId(setId);
  const eventLogEntityId = getEventLogEntityId(
    event.transaction.hash,
    event.logIndex
  );
  const transactionEntityId = getTransactionEntityId(event.transaction.hash);

  // Create Event Log
  const eventLog = new EventLog(eventLogEntityId);
  eventLog.setId = setId;
  eventLog.address = event.address;
  eventLog.name = "NextProvingPeriod";
  eventLog.data = `{"setId":"${setId.toString()}","challengeEpoch":"${challengeEpoch.toString()}","leafCount":"${leafCount.toString()}"}`;
  eventLog.logIndex = event.logIndex;
  eventLog.transactionHash = event.transaction.hash;
  eventLog.createdAt = event.block.timestamp;
  eventLog.blockNumber = event.block.number;
  // Link entities
  eventLog.proofSet = proofSetEntityId;
  eventLog.transaction = transactionEntityId;
  eventLog.save();

  // Create Transaction (if it doesn't exist)
  let transaction = Transaction.load(transactionEntityId);
  if (transaction == null) {
    transaction = new Transaction(transactionEntityId);
    transaction.hash = event.transaction.hash;
    transaction.dataSetId = setId;
    transaction.height = event.block.number;
    transaction.fromAddress = event.transaction.from;
    transaction.toAddress = event.transaction.to;
    transaction.value = event.transaction.value;
    transaction.method = "nextProvingPeriod"; // Example method name
    transaction.status = true;
    transaction.createdAt = event.block.timestamp;
    transaction.proofSet = proofSetEntityId; // Link to DataSet
    transaction.save();
  }

  // Update Data Set
  const proofSet = DataSet.load(proofSetEntityId);
  if (proofSet) {
    proofSet.nextChallengeEpoch = challengeEpoch;
    proofSet.challengeRange = leafCount;

    // Set firstDeadline if this is the first NextProvingPeriod call
    if (proofSet.firstDeadline.equals(BigInt.fromI32(0))) {
      proofSet.firstDeadline = event.block.number;

      // Set default values for proving period configuration
      // These could be loaded from contract state or configuration
      // mainnet: 2880, calibration: 240
      proofSet.maxProvingPeriod = BigInt.fromI32(240);
      proofSet.challengeWindowSize = BigInt.fromI32(20);

      log.info("Set firstDeadline for DataSet {}: block {}", [
        setId.toString(),
        event.block.number.toString()
      ]);
    }

    // Increment deadline count for subsequent calls
    proofSet.currentDeadlineCount = proofSet.currentDeadlineCount.plus(BigInt.fromI32(1));

    // Calculate current deadline
    const currentDeadline = proofSet.firstDeadline.plus(
      proofSet.currentDeadlineCount.times(proofSet.maxProvingPeriod)
    );

    // Create ProvingWindow entity
    const provingWindowId = Bytes.fromUTF8(setId.toString() + "-" + proofSet.currentDeadlineCount.toString());
    let provingWindow = new ProvingWindow(provingWindowId);
    provingWindow.setId = setId;
    provingWindow.deadlineCount = proofSet.currentDeadlineCount;
    provingWindow.deadline = currentDeadline;
    provingWindow.windowStart = currentDeadline.minus(proofSet.challengeWindowSize);
    provingWindow.windowEnd = currentDeadline;
    provingWindow.proofSubmitted = false;
    provingWindow.proofBlockNumber = BigInt.fromI32(0);
    provingWindow.isValid = false;
    provingWindow.createdAt = event.block.timestamp;
    provingWindow.proofSet = proofSetEntityId;
    provingWindow.save();

    log.info("Created ProvingWindow for DataSet {}, deadline count {}, window: {} - {}", [
      setId.toString(),
      proofSet.currentDeadlineCount.toString(),
      provingWindow.windowStart.toString(),
      provingWindow.windowEnd.toString()
    ]);

    proofSet.totalTransactions = proofSet.totalTransactions.plus(
      BigInt.fromI32(1)
    );
    proofSet.totalEventLogs = proofSet.totalEventLogs.plus(BigInt.fromI32(1));
    proofSet.updatedAt = event.block.timestamp;
    proofSet.blockNumber = event.block.number;
    proofSet.save();
  } else {
    log.warning("NextProvingPeriod: DataSet {} not found", [setId.toString()]);
  }
}

export function handlePiecesAdded(event: PiecesAddedEvent): void {
  const setId = event.params.setId;
  const rootIdsFromEvent = event.params.pieceIds; // Get root IDs from event params
  const pieceCidsFromEvent = event.params.pieceCids;

  // Input parsing is necessary to get rawSize and root bytes (cid)
  const txInput = event.transaction.input;

  if (txInput.length < 4) {
    log.error("Invalid tx input length in handlePiecesAdded: {}", [
      event.transaction.hash.toHex(),
    ]);
    return;
  }

  const proofSetEntityId = getProofSetEntityId(setId);
  const eventLogEntityId = getEventLogEntityId(
    event.transaction.hash,
    event.logIndex
  );
  const transactionEntityId = getTransactionEntityId(event.transaction.hash);

  // Create Event Log
  const eventLog = new EventLog(eventLogEntityId);
  eventLog.setId = setId;
  eventLog.address = event.address;
  eventLog.name = "piecesAdded";
  // Store simple representation of event params
  let rootIdStrings: string[] = [];
  for (let i = 0; i < rootIdsFromEvent.length; i++) {
    rootIdStrings.push(rootIdsFromEvent[i].toString());
  }
  eventLog.data = `{ "setId": "${setId.toString()}", "rootIds": [${rootIdStrings.join(",")}] }`;
  eventLog.logIndex = event.logIndex;
  eventLog.transactionHash = event.transaction.hash;
  eventLog.createdAt = event.block.timestamp;
  eventLog.blockNumber = event.block.number;
  eventLog.proofSet = proofSetEntityId;
  eventLog.transaction = transactionEntityId;
  eventLog.save();

  // Create Transaction (if it doesn't exist)
  let transaction = Transaction.load(transactionEntityId);
  if (transaction == null) {
    transaction = new Transaction(transactionEntityId);
    transaction.hash = event.transaction.hash;
    transaction.dataSetId = setId;
    transaction.height = event.block.number;
    transaction.fromAddress = event.transaction.from;
    const toAddress = event.transaction.to;
    if (toAddress) {
      transaction.toAddress = toAddress;
    }
    transaction.value = event.transaction.value;
    transaction.method = "addPieces"; // Example method name
    transaction.status = true;
    transaction.createdAt = event.block.timestamp;
    transaction.proofSet = proofSetEntityId;
    transaction.save();
  }

  // Load DataSet
  const proofSet = DataSet.load(proofSetEntityId);
  if (!proofSet) {
    log.warning("handlePiecesAdded: DataSet {} not found for event tx {}", [
      setId.toString(),
      event.transaction.hash.toHex(),
    ]);
    return;
  }

  // --- Parse Transaction Input --- Requires helper functions
  // Skip function selector (first 4 bytes)
  const encodedData = Bytes.fromUint8Array(txInput.slice(4));

  // Decode setId (uint256 at offset 0)
  let decodedSetId: BigInt = readUint256(encodedData, 0);
  if (decodedSetId != setId) {
    log.warning(
      "Decoded setId {} does not match event param {} in handlePiecesAdded. Tx: {}. Using event param.",
      [
        decodedSetId.toString(),
        setId.toString(),
        event.transaction.hash.toHex(),
      ]
    );
  }

  // Decode rootsData (tuple[])
  let rootsDataOffset = readUint256(encodedData, 64).toI32(); // Offset is at byte 32
  let rootsDataLength: i32;

  if (rootsDataOffset < 0 || encodedData.length < rootsDataOffset + 32) {
    log.error(
      "handlePiecesAdded: Invalid rootsDataOffset {} or data length {} for reading rootsData length. Tx: {}",
      [
        rootsDataOffset.toString(),
        encodedData.length.toString(),
        event.transaction.hash.toHex(),
      ]
    );
    return;
  }

  rootsDataLength = readUint256(encodedData, rootsDataOffset).toI32(); // Length is at the offset

  if (rootsDataLength < 0) {
    log.error("handlePiecesAdded: Invalid negative rootsDataLength {}. Tx: {}", [
      rootsDataLength.toString(),
      event.transaction.hash.toHex(),
    ]);
    return;
  }

  // Check if number of roots from input matches event param
  if (rootsDataLength != rootIdsFromEvent.length) {
    log.error(
      "handlePiecesAdded: Decoded roots count ({}) does not match event param count ({}). Tx: {}",
      [
        rootsDataLength.toString(),
        rootIdsFromEvent.length.toString(),
        event.transaction.hash.toHex(),
      ]
    );
    // Decide how to proceed. For now, use the event length as the source of truth for iteration.
    rootsDataLength = rootIdsFromEvent.length;
  }

  let addedRootCount = 0;
  let totalDataSizeAdded = BigInt.fromI32(0);

  // Create Root entities
  const structsBaseOffset = rootsDataOffset + 32; // Start of struct offsets/data



  for (let i = 0; i < rootsDataLength; i++) {
    const rootId = rootIdsFromEvent[i]; // Use rootId from event params
    const pieceCid = pieceCidsFromEvent[i];

    // Calculate offset for this struct's data
    const structDataRelOffset = readUint256(
      encodedData,
      structsBaseOffset + i * 32
    ).toI32();
    const structDataAbsOffset = rootsDataOffset + 32 + structDataRelOffset; // Correct absolute offset

    // Check bounds for reading struct content (root offset + rawSize)
    if (
      structDataAbsOffset < 0 ||
      encodedData.length < structDataAbsOffset + 64
    ) {
      log.error(
        "handlePiecesAdded: Encoded data too short or invalid offset for root struct content. Index: {}, Offset: {}, Len: {}. Tx: {}",
        [
          i.toString(),
          structDataAbsOffset.toString(),
          encodedData.length.toString(),
          event.transaction.hash.toHex(),
        ]
      );
      continue; // Skip this root
    }

    const pieceBytes = pieceCid.data;
    const commPData = validateCommPv2(pieceBytes);
    const rawSize = commPData.isValid ? unpaddedSize(commPData.padding, commPData.height) : BigInt.zero();

    const rootEntityId = getRootEntityId(setId, rootId);

    let root = Root.load(rootEntityId);
    if (root) {
      log.warning(
        "handlePiecesAdded: Root {} for Set {} already exists. This shouldn't happen. Skipping.",
        [rootId.toString(), setId.toString()]
      );
      continue;
    }

    root = new Root(rootEntityId);
    root.rootId = rootId;
    root.setId = setId;
    root.rawSize = rawSize; // Use correct field name
    root.leafCount = rawSize.div(BigInt.fromI32(LeafSize));
    root.cid = pieceCid.data; // Use correct field name
    root.removed = false; // Explicitly set removed to false
    root.lastProvenEpoch = BigInt.fromI32(0);
    root.lastProvenAt = BigInt.fromI32(0);
    root.lastFaultedEpoch = BigInt.fromI32(0);
    root.lastFaultedAt = BigInt.fromI32(0);
    root.totalProofsSubmitted = BigInt.fromI32(0);
    root.totalPeriodsFaulted = BigInt.fromI32(0);
    root.createdAt = event.block.timestamp;
    root.updatedAt = event.block.timestamp;
    root.blockNumber = event.block.number;
    root.proofSet = proofSetEntityId; // Link to DataSet

    root.save();

    // Update SumTree
    const sumTree = new SumTree();
    sumTree.sumTreeAdd(
      setId.toI32(),
      rawSize.div(BigInt.fromI32(LeafSize)),
      rootId.toI32()
    );

    addedRootCount += 1;
    totalDataSizeAdded = totalDataSizeAdded.plus(rawSize);
  }

  // Update DataSet stats
  proofSet.totalRoots = proofSet.totalRoots.plus(
    BigInt.fromI32(addedRootCount)
  ); // Use correct field name
  proofSet.nextPieceId = proofSet.nextPieceId.plus(
    BigInt.fromI32(addedRootCount)
  );
  proofSet.totalDataSize = proofSet.totalDataSize.plus(totalDataSizeAdded);
  proofSet.leafCount = proofSet.leafCount.plus(
    totalDataSizeAdded.div(BigInt.fromI32(LeafSize))
  );
  proofSet.totalTransactions = proofSet.totalTransactions.plus(
    BigInt.fromI32(1)
  );
  proofSet.totalEventLogs = proofSet.totalEventLogs.plus(BigInt.fromI32(1));
  proofSet.updatedAt = event.block.timestamp;
  proofSet.blockNumber = event.block.number;
  proofSet.save();

  // Update Provider stats
  const provider = Provider.load(proofSet.owner);
  if (provider) {
    provider.totalDataSize = provider.totalDataSize.plus(totalDataSizeAdded);
    provider.totalRoots = provider.totalRoots.plus(
      BigInt.fromI32(addedRootCount)
    );
    provider.updatedAt = event.block.timestamp;
    provider.blockNumber = event.block.number;
    provider.save();
  } else {
    log.warning("handlePiecesAdded: Provider {} for DataSet {} not found", [
      proofSet.owner.toHex(),
      setId.toString(),
    ]);
  }

  // update Service stats
  const service = Service.load(proofSet.listener);
  if (service) {
    service.totalRoots = service.totalRoots.plus(
      BigInt.fromI32(addedRootCount)
    );
    service.totalDataSize = service.totalDataSize.plus(totalDataSizeAdded);
    service.updatedAt = event.block.number;
    service.save();
  }

  // Update network metrics
  saveNetworkMetrics(
    ["totalRoots", "totalActiveRoots", "totalDataSize"],
    [
      BigInt.fromI32(addedRootCount),
      BigInt.fromI32(addedRootCount),
      totalDataSizeAdded,
    ],
    ["add", "add", "add"]
  );

  // update provider and proof set metrics
  const weekId = event.block.timestamp.toI32() / 604800;
  const monthId = event.block.timestamp.toI32() / 2592000;
  const providerId = proofSet.owner;
  const weeklyProviderId = Bytes.fromI32(weekId).concat(providerId);
  const monthlyProviderId = Bytes.fromI32(monthId).concat(providerId);
  const weeklyProofSetId = Bytes.fromI32(weekId).concat(proofSetEntityId);
  const monthlyProofSetId = Bytes.fromI32(monthId).concat(proofSetEntityId);
  saveProviderMetrics(
    "WeeklyProviderActivity",
    weeklyProviderId,
    providerId,
    ["totalRootsAdded", "totalDataSizeAdded"],
    [BigInt.fromI32(addedRootCount), totalDataSizeAdded],
    ["add", "add"]
  );
  saveProviderMetrics(
    "MonthlyProviderActivity",
    monthlyProviderId,
    providerId,
    ["totalRootsAdded", "totalDataSizeAdded"],
    [BigInt.fromI32(addedRootCount), totalDataSizeAdded],
    ["add", "add"]
  );
  saveProofSetMetrics(
    "WeeklyProofSetActivity",
    weeklyProofSetId,
    setId,
    ["totalRootsAdded", "totalDataSizeAdded"],
    [BigInt.fromI32(addedRootCount), totalDataSizeAdded],
    ["add", "add"]
  );
  saveProofSetMetrics(
    "MonthlyProofSetActivity",
    monthlyProofSetId,
    setId,
    ["totalRootsAdded", "totalDataSizeAdded"],
    [BigInt.fromI32(addedRootCount), totalDataSizeAdded],
    ["add", "add"]
  );
}

export function handlePiecesRemoved(event: PiecesRemovedEvent): void {
  const setId = event.params.setId;
  const pieceIds = event.params.pieceIds;

  const proofSetEntityId = getProofSetEntityId(setId);
  const eventLogEntityId = getEventLogEntityId(
    event.transaction.hash,
    event.logIndex
  );
  const transactionEntityId = getTransactionEntityId(event.transaction.hash);

  // Create Event Log
  const eventLog = new EventLog(eventLogEntityId);
  eventLog.setId = setId;
  eventLog.address = event.address;
  eventLog.name = "PiecesRemoved";
  // Store simple representation of event params
  let removedRootIdStrings: string[] = [];
  for (let i = 0; i < pieceIds.length; i++) {
    removedRootIdStrings.push(pieceIds[i].toString());
  }
  eventLog.data = `{ "setId": "${setId.toString()}", "pieceIds": [${removedRootIdStrings.join(",")}] }`;
  eventLog.logIndex = event.logIndex;
  eventLog.transactionHash = event.transaction.hash;
  eventLog.createdAt = event.block.timestamp;
  eventLog.blockNumber = event.block.number;
  eventLog.proofSet = proofSetEntityId;
  eventLog.transaction = transactionEntityId;
  eventLog.save();

  // Load DataSet
  const proofSet = DataSet.load(proofSetEntityId);
  if (!proofSet) {
    log.warning("handlePiecesRemoved: DataSet {} not found for event tx {}", [
      setId.toString(),
      event.transaction.hash.toHex(),
    ]);
    return;
  }

  let removedRootCount = 0;
  let removedDataSize = BigInt.fromI32(0);

  // Mark Root entities as removed (soft delete)
  for (let i = 0; i < pieceIds.length; i++) {
    const rootId = pieceIds[i];
    const rootEntityId = getRootEntityId(setId, rootId);

    const root = Root.load(rootEntityId);
    if (root) {
      removedRootCount += 1;
      removedDataSize = removedDataSize.plus(root.rawSize); // Use correct field name

      // Mark the Root entity as removed instead of deleting
      root.removed = true;
      root.updatedAt = event.block.timestamp;
      root.blockNumber = event.block.number;
      root.save();

      // Update SumTree
      const sumTree = new SumTree();
      sumTree.sumTreeRemove(
        setId.toI32(),
        proofSet.nextPieceId.toI32(),
        rootId.toI32(),
        root.rawSize.div(BigInt.fromI32(LeafSize)),
        event.block.number
      );
    } else {
      log.warning(
        "handlePiecesRemoved: Root {} for Set {} not found. Cannot remove.",
        [rootId.toString(), setId.toString()]
      );
    }
  }

  // Update DataSet stats
  proofSet.totalRoots = proofSet.totalRoots.minus(
    BigInt.fromI32(removedRootCount)
  ); // Use correct field name
  proofSet.totalDataSize = proofSet.totalDataSize.minus(removedDataSize);
  proofSet.leafCount = proofSet.leafCount.minus(
    removedDataSize.div(BigInt.fromI32(LeafSize))
  );

  // Ensure stats don't go negative
  if (proofSet.totalRoots.lt(BigInt.fromI32(0))) {
    // Use correct field name
    log.warning(
      "handlePiecesRemoved: DataSet {} rootCount went negative. Setting to 0.",
      [setId.toString()]
    );
    proofSet.totalRoots = BigInt.fromI32(0); // Use correct field name
  }
  if (proofSet.totalDataSize.lt(BigInt.fromI32(0))) {
    log.warning(
      "handlePiecesRemoved: DataSet {} totalDataSize went negative. Setting to 0.",
      [setId.toString()]
    );
    proofSet.totalDataSize = BigInt.fromI32(0);
  }
  if (proofSet.leafCount.lt(BigInt.fromI32(0))) {
    log.warning(
      "handlePiecesRemoved: DataSet {} leafCount went negative. Setting to 0.",
      [setId.toString()]
    );
    proofSet.leafCount = BigInt.fromI32(0);
  }
  proofSet.totalEventLogs = proofSet.totalEventLogs.plus(BigInt.fromI32(1));
  proofSet.updatedAt = event.block.timestamp;
  proofSet.blockNumber = event.block.number;
  proofSet.save();

  // Update Provider stats
  const provider = Provider.load(proofSet.owner);
  if (provider) {
    provider.totalDataSize = provider.totalDataSize.minus(removedDataSize);
    // Ensure provider totalDataSize doesn't go negative
    if (provider.totalDataSize.lt(BigInt.fromI32(0))) {
      log.warning(
        "handlePiecesRemoved: Provider {} totalDataSize went negative. Setting to 0.",
        [proofSet.owner.toHex()]
      );
      provider.totalDataSize = BigInt.fromI32(0);
    }
    provider.totalRoots = provider.totalRoots.minus(
      BigInt.fromI32(removedRootCount)
    );
    // Ensure provider totalRoots doesn't go negative
    if (provider.totalRoots.lt(BigInt.fromI32(0))) {
      log.warning(
        "handlePiecesRemoved: Provider {} totalRoots went negative. Setting to 0.",
        [proofSet.owner.toHex()]
      );
      provider.totalRoots = BigInt.fromI32(0);
    }
    provider.updatedAt = event.block.timestamp;
    provider.blockNumber = event.block.number;
    provider.save();
  } else {
    log.warning("handlePiecesRemoved: Provider {} for DataSet {} not found", [
      proofSet.owner.toHex(),
      setId.toString(),
    ]);
  }

  // update Service stats
  const service = Service.load(proofSet.listener);
  if (service) {
    service.totalRoots = service.totalRoots.minus(
      BigInt.fromI32(removedRootCount)
    );
    // ensure totalRoots doesn't go negative
    if (service.totalRoots.lt(BigInt.fromI32(0))) {
      log.warning(
        "handlePiecesRemoved: Service {} totalRoots went negative. Setting to 0.",
        [proofSet.listener.toHex()]
      );
      service.totalRoots = BigInt.fromI32(0);
    }
    service.totalDataSize = service.totalDataSize.minus(removedDataSize);
    // ensure totalDataSize doesn't go negative
    if (service.totalDataSize.lt(BigInt.fromI32(0))) {
      log.warning(
        "handlePiecesRemoved: Service {} totalDataSize went negative. Setting to 0.",
        [proofSet.listener.toHex()]
      );
      service.totalDataSize = BigInt.fromI32(0);
    }
    service.updatedAt = event.block.number;
    service.save();
  }

  // Update network metrics
  saveNetworkMetrics(
    ["totalActiveRoots", "totalDataSize"],
    [BigInt.fromI32(removedRootCount), removedDataSize],
    ["subtract", "subtract"]
  );

  // Update provider and proof set metrics
  const weekId = event.block.timestamp.toI32() / 604800;
  const monthId = event.block.timestamp.toI32() / 2592000;
  const providerId = proofSet.owner;
  const weeklyProviderId = Bytes.fromI32(weekId).concat(providerId);
  const monthlyProviderId = Bytes.fromI32(monthId).concat(providerId);
  const weeklyProofSetId = Bytes.fromI32(weekId).concat(proofSetEntityId);
  const monthlyProofSetId = Bytes.fromI32(monthId).concat(proofSetEntityId);
  saveProviderMetrics(
    "WeeklyProviderActivity",
    weeklyProviderId,
    providerId,
    ["totalRootsRemoved", "totalDataSizeRemoved"],
    [BigInt.fromI32(removedRootCount), removedDataSize],
    ["add", "add"]
  );
  saveProviderMetrics(
    "MonthlyProviderActivity",
    monthlyProviderId,
    providerId,
    ["totalRootsRemoved", "totalDataSizeRemoved"],
    [BigInt.fromI32(removedRootCount), removedDataSize],
    ["add", "add"]
  );
  saveProofSetMetrics(
    "WeeklyProofSetActivity",
    weeklyProofSetId,
    setId,
    ["totalRootsRemoved", "totalDataSizeRemoved"],
    [BigInt.fromI32(removedRootCount), removedDataSize],
    ["add", "add"]
  );
  saveProofSetMetrics(
    "MonthlyProofSetActivity",
    monthlyProofSetId,
    setId,
    ["totalRootsRemoved", "totalDataSizeRemoved"],
    [BigInt.fromI32(removedRootCount), removedDataSize],
    ["add", "add"]
  );
}

// Helper function to read Uint256 from Bytes at a specific offset
function readUint256(data: Bytes, offset: i32): BigInt {
  if (offset < 0 || data.length < offset + 32) {
    log.error(
      "readUint256: Invalid offset {} or data length {} for reading Uint256",
      [offset.toString(), data.length.toString()]
    );
    return BigInt.zero();
  }
  // Slice 32 bytes and convert to BigInt (assuming big-endian)
  const slicedBytes = Bytes.fromUint8Array(data.slice(offset, offset + 32));
  // Ensure bytes are reversed for correct BigInt conversion if needed (depends on source endianness)
  // AssemblyScript's BigInt.fromUnsignedBytes assumes little-endian by default, reverse for big-endian
  const reversedBytesArray = slicedBytes.reverse(); // Returns Uint8Array
  const reversedBytes = Bytes.fromUint8Array(reversedBytesArray); // Create Bytes object
  return BigInt.fromUnsignedBytes(reversedBytes);
}

// Helper function to read dynamic Bytes from ABI-encoded data
function readBytes(data: Bytes, offset: i32): Bytes {
  // First, read the offset to the actual bytes data (uint256)
  const bytesTupleOffset = readUint256(data, offset).toI32();

  // Check if the bytes offset is valid
  if (bytesTupleOffset < 0 || data.length < offset + bytesTupleOffset + 32) {
    log.error(
      "readBytes: Invalid offset {} or data length {} for reading bytes length",
      [bytesTupleOffset.toString(), data.length.toString()]
    );
    return Bytes.empty();
  }

  const bytesOffset = readUint256(data, offset + bytesTupleOffset).toI32();
  const bytesAbsOffset = offset + bytesTupleOffset + bytesOffset;
  // Read the length of the bytes (uint256)
  const bytesLength = readUint256(data, bytesAbsOffset).toI32();

  // Check if the length is valid
  if (bytesLength < 0 || data.length < bytesAbsOffset + 32 + bytesLength) {
    log.error(
      "readBytes: Invalid length {} or data length {} for reading bytes data",
      [bytesLength.toString(), data.length.toString()]
    );
    return Bytes.empty();
  }

  // Slice the actual bytes
  return Bytes.fromUint8Array(
    data.slice(bytesAbsOffset + 32, bytesAbsOffset + 32 + bytesLength)
  );
}
