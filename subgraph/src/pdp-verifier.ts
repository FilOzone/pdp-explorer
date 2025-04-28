import { BigInt, Bytes, log, store, Value } from "@graphprotocol/graph-ts";
import {
  NextProvingPeriod as NextProvingPeriodEvent,
  PossessionProven as PossessionProvenEvent,
  ProofFeePaid as ProofFeePaidEvent,
  ProofSetCreated as ProofSetCreatedEvent,
  ProofSetDeleted as ProofSetDeletedEvent,
  ProofSetEmpty as ProofSetEmptyEvent,
  ProofSetOwnerChanged as ProofSetOwnerChangedEvent,
  RootsAdded as RootsAddedEvent,
  RootsRemoved as RootsRemovedEvent,
} from "../generated/PDPVerifier/PDPVerifier";
import {
  EventLog,
  Provider,
  ProofSet,
  Root,
  Transaction,
} from "../generated/schema";
import {
  saveProviderMetrics,
  saveProofSetMetrics,
  saveNetworkMetrics,
} from "./helper";
import { SumTree } from "./sumTree";
import { LeafSize } from "../utils";

// --- Helper Functions for ID Generation ---
function getProofSetEntityId(setId: BigInt): Bytes {
  return Bytes.fromByteArray(Bytes.fromBigInt(setId));
}

function getRootEntityId(setId: BigInt, rootId: BigInt): Bytes {
  return Bytes.fromUTF8(setId.toString() + "-" + rootId.toString());
}

function getTransactionEntityId(txHash: Bytes): Bytes {
  return txHash;
}

function getEventLogEntityId(txHash: Bytes, logIndex: BigInt): Bytes {
  return txHash.concatI32(logIndex.toI32());
}

// -----------------------------------------

export function handleProofSetCreated(event: ProofSetCreatedEvent): void {
  const listenerAddr = Bytes.fromUint8Array(
    event.transaction.input.subarray(16, 36)
  );

  const proofSetEntityId = getProofSetEntityId(event.params.setId);
  const transactionEntityId = getTransactionEntityId(event.transaction.hash);
  const eventLogEntityId = getEventLogEntityId(
    event.transaction.hash,
    event.logIndex
  );
  const providerEntityId = event.params.owner; // Provider ID is the owner address

  // Create Event Log
  const eventLog = new EventLog(eventLogEntityId);
  eventLog.setId = event.params.setId; // Keep raw ID for potential filtering
  eventLog.address = event.address;
  eventLog.name = "ProofSetCreated";
  eventLog.data = `{"setId":"${event.params.setId.toString()}","owner":"${event.params.owner.toHexString()}"}`;
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
    transaction.proofSetId = event.params.setId; // Keep raw ID for potential filtering
    transaction.height = event.block.number;
    transaction.fromAddress = event.transaction.from;
    transaction.toAddress = event.transaction.to; // Can be null for contract creation
    transaction.value = event.transaction.value;
    transaction.method = "createProofSet"; // Or derive from input data if possible
    transaction.status = true; // Assuming success if event emitted
    transaction.createdAt = event.block.timestamp;
    // Link entities
    transaction.proofSet = proofSetEntityId;
    transaction.save();
  }

  // Create ProofSet
  let proofSet = new ProofSet(proofSetEntityId);
  proofSet.setId = event.params.setId;
  proofSet.owner = providerEntityId; // Link to Provider via owner address (which is Provider's ID)
  proofSet.listener = listenerAddr;
  proofSet.isActive = true;
  proofSet.leafCount = BigInt.fromI32(0);
  proofSet.challengeRange = BigInt.fromI32(0);
  proofSet.lastProvenEpoch = BigInt.fromI32(0);
  proofSet.nextChallengeEpoch = BigInt.fromI32(0);
  proofSet.totalRoots = BigInt.fromI32(0);
  proofSet.nextRootId = BigInt.fromI32(0);
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

  // Create or Update Provider
  let provider = Provider.load(providerEntityId);
  if (provider == null) {
    provider = new Provider(providerEntityId);
    provider.address = event.params.owner;
    provider.totalRoots = BigInt.fromI32(0);
    provider.totalProofSets = BigInt.fromI32(1);
    provider.totalFaultedPeriods = BigInt.fromI32(0);
    provider.totalFaultedRoots = BigInt.fromI32(0);
    provider.totalDataSize = BigInt.fromI32(0);
    provider.createdAt = event.block.timestamp;
    provider.blockNumber = event.block.number;

    // update network metrics
    saveNetworkMetrics(
      ["totalProofSets", "totalActiveProofSets", "totalProviders"],
      [BigInt.fromI32(1), BigInt.fromI32(1), BigInt.fromI32(1)],
      ["add", "add", "add"]
    );
  } else {
    // Update timestamp/block even if exists
    provider.totalProofSets = provider.totalProofSets.plus(BigInt.fromI32(1));
    provider.blockNumber = event.block.number;

    // update network metrics
    saveNetworkMetrics(
      ["totalProofSets", "totalActiveProofSets"],
      [BigInt.fromI32(1), BigInt.fromI32(1)],
      ["add", "add"]
    );
  }
  // provider.proofSetIds = provider.proofSetIds.concat([event.params.setId]); // REMOVED - Handled by @derivedFrom
  provider.updatedAt = event.block.timestamp;
  provider.save();

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

export function handleProofSetDeleted(event: ProofSetDeletedEvent): void {
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
  eventLog.name = "ProofSetDeleted";
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
    transaction.proofSetId = setId;
    transaction.height = event.block.number;
    transaction.fromAddress = event.transaction.from;
    transaction.toAddress = event.transaction.to;
    transaction.value = event.transaction.value;
    transaction.method = "deleteProofSet"; // Example method name
    transaction.status = true;
    transaction.createdAt = event.block.timestamp;
    transaction.proofSet = proofSetEntityId; // Link to ProofSet
    transaction.save();
  }

  // Load ProofSet
  const proofSet = ProofSet.load(proofSetEntityId);
  if (!proofSet) {
    log.warning("ProofSetDeleted: ProofSet {} not found", [setId.toString()]);
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
    log.warning("ProofSetDeleted: Provider {} for ProofSet {} not found", [
      ownerAddress.toHexString(),
      setId.toString(),
    ]);
  }

  // Update ProofSet
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

  // Note: Roots associated with this ProofSet are not automatically removed or updated here.
  // They still exist but are linked to an inactive ProofSet.
  // Consider if Roots should be marked as inactive or removed in handleRootsRemoved if needed.
}

export function handleProofSetOwnerChanged(
  event: ProofSetOwnerChangedEvent
): void {
  const setId = event.params.setId;
  const oldOwner = event.params.oldOwner;
  const newOwner = event.params.newOwner;

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
  eventLog.name = "ProofSetOwnerChanged";
  eventLog.data = `{"setId":"${setId.toString()}","oldOwner":"${oldOwner.toHexString()}","newOwner":"${newOwner.toHexString()}"}`;
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
    transaction.proofSetId = setId;
    transaction.height = event.block.number;
    transaction.fromAddress = event.transaction.from;
    transaction.toAddress = event.transaction.to;
    transaction.value = event.transaction.value;
    transaction.method = "claimProofSetOwnership"; // Example method name
    transaction.status = true;
    transaction.createdAt = event.block.timestamp;
    transaction.proofSet = proofSetEntityId; // Link to ProofSet
    transaction.save();
  }

  // Load ProofSet
  const proofSet = ProofSet.load(proofSetEntityId);
  if (!proofSet) {
    log.warning("ProofSetOwnerChanged: ProofSet {} not found", [
      setId.toString(),
    ]);
    return;
  }

  // Load Old Provider (if exists) - Just update timestamp, derived field handles removal
  const oldProvider = Provider.load(oldOwner);
  if (oldProvider) {
    oldProvider.totalProofSets = oldProvider.totalProofSets.minus(
      BigInt.fromI32(1)
    );
    oldProvider.updatedAt = event.block.timestamp;
    oldProvider.blockNumber = event.block.number;
    oldProvider.save();
  } else {
    log.warning("ProofSetOwnerChanged: Old Provider {} not found", [
      oldOwner.toHexString(),
    ]);
  }

  // Load or Create New Provider - Just update timestamp/create, derived field handles addition
  let newProvider = Provider.load(newOwner);
  if (newProvider == null) {
    // update network metrics
    saveNetworkMetrics(["totalProviders"], [BigInt.fromI32(1)], ["add"]);
    newProvider = new Provider(newOwner);
    newProvider.address = newOwner;
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

  // Update ProofSet Owner (this updates the derived relationship on both old and new Provider)
  proofSet.owner = newOwner; // Set owner to the new provider's ID
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
  const filUsdPrice = event.params.price;
  const filUsdPriceExponent = event.params.expo;

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
  eventLog.data = `{"proofSetId":"${setId.toString()}","fee":"${fee.toString()}","filUsdPrice":"${filUsdPrice.toString()}","filUsdPriceExponent":"${filUsdPriceExponent.toString()}"}`;
  eventLog.logIndex = event.logIndex;
  eventLog.transactionHash = event.transaction.hash;
  eventLog.createdAt = event.block.timestamp;
  eventLog.blockNumber = event.block.number;
  // Link entities
  eventLog.proofSet = proofSetEntityId;
  eventLog.transaction = transactionEntityId;
  eventLog.save();

  // Update ProofSet total fee paid
  const proofSet = ProofSet.load(proofSetEntityId);
  if (proofSet) {
    proofSet.totalFeePaid = proofSet.totalFeePaid.plus(fee);
    proofSet.totalEventLogs = proofSet.totalEventLogs.plus(BigInt.fromI32(1));
    proofSet.updatedAt = event.block.timestamp;
    proofSet.blockNumber = event.block.number;
    proofSet.save();
  } else {
    log.warning("ProofFeePaid: ProofSet {} not found", [setId.toString()]);
  }
}

export function handleProofSetEmpty(event: ProofSetEmptyEvent): void {
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
  eventLog.name = "ProofSetEmpty";
  eventLog.data = `{"setId":"${setId.toString()}"}`;
  eventLog.logIndex = event.logIndex;
  eventLog.transactionHash = event.transaction.hash;
  eventLog.createdAt = event.block.timestamp;
  eventLog.blockNumber = event.block.number;
  // Link entities
  eventLog.proofSet = proofSetEntityId;
  eventLog.transaction = transactionEntityId;
  eventLog.save();

  // Update ProofSet
  const proofSet = ProofSet.load(proofSetEntityId);
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
      log.warning("ProofSetEmpty: Provider {} for ProofSet {} not found", [
        proofSet.owner.toHexString(),
        setId.toString(),
      ]);
    }
  } else {
    log.warning("ProofSetEmpty: ProofSet {} not found", [setId.toString()]);
  }
  // Note: This event implies all roots are gone. Existing Root entities
  // linked to this ProofSet might need to be marked as removed or deleted
  // depending on the desired data retention policy. This handler doesn't do that.
  // Consider adding logic here or in handleRootsRemoved if needed.
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
    challengesStr += `{"rootId":${challenges[i].rootId.toString()},"offset":${challenges[i].offset.toString()}}`;
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
    transaction.proofSetId = setId; // Keep raw ID
    transaction.height = currentBlockNumber;
    transaction.fromAddress = event.transaction.from;
    transaction.toAddress = event.transaction.to;
    transaction.value = event.transaction.value;
    transaction.method = "provePossession"; // Example method name
    transaction.status = true;
    transaction.createdAt = currentTimestamp;
    transaction.proofSet = proofSetEntityId; // Link to ProofSet
    transaction.save();
  }

  let uniqueRoots: BigInt[] = [];
  let rootIdMap = new Map<string, boolean>();

  // Process each challenge
  for (let i = 0; i < challenges.length; i++) {
    const challenge = challenges[i];
    const rootId = challenge.rootId;

    const rootIdStr = rootId.toString();
    if (!rootIdMap.has(rootIdStr)) {
      uniqueRoots.push(rootId);
      rootIdMap.set(rootIdStr, true);
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

  // Update ProofSet (once per event)
  const proofSet = ProofSet.load(proofSetEntityId);
  if (proofSet) {
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
    log.warning("PossessionProven: ProofSet {} not found", [setId.toString()]);
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
    transaction.proofSetId = setId;
    transaction.height = event.block.number;
    transaction.fromAddress = event.transaction.from;
    transaction.toAddress = event.transaction.to;
    transaction.value = event.transaction.value;
    transaction.method = "nextProvingPeriod"; // Example method name
    transaction.status = true;
    transaction.createdAt = event.block.timestamp;
    transaction.proofSet = proofSetEntityId; // Link to ProofSet
    transaction.save();
  }

  // Update Proof Set
  const proofSet = ProofSet.load(proofSetEntityId);
  if (proofSet) {
    proofSet.nextChallengeEpoch = challengeEpoch;
    proofSet.challengeRange = leafCount;
    proofSet.totalTransactions = proofSet.totalTransactions.plus(
      BigInt.fromI32(1)
    );
    proofSet.totalEventLogs = proofSet.totalEventLogs.plus(BigInt.fromI32(1));
    proofSet.updatedAt = event.block.timestamp;
    proofSet.blockNumber = event.block.number;
    proofSet.save();
  } else {
    log.warning("NextProvingPeriod: ProofSet {} not found", [setId.toString()]);
  }
}

export function handleRootsAdded(event: RootsAddedEvent): void {
  const setId = event.params.setId;
  const rootIdsFromEvent = event.params.rootIds; // Get root IDs from event params

  // Input parsing is necessary to get rawSize and root bytes (cid)
  const txInput = event.transaction.input;

  if (txInput.length < 4) {
    log.error("Invalid tx input length in handleRootsAdded: {}", [
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
  eventLog.name = "RootsAdded";
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
    transaction.proofSetId = setId;
    transaction.height = event.block.number;
    transaction.fromAddress = event.transaction.from;
    const toAddress = event.transaction.to;
    if (toAddress) {
      transaction.toAddress = toAddress;
    }
    transaction.value = event.transaction.value;
    transaction.method = "addRoots"; // Example method name
    transaction.status = true;
    transaction.createdAt = event.block.timestamp;
    transaction.proofSet = proofSetEntityId;
    transaction.save();
  }

  // Load ProofSet
  const proofSet = ProofSet.load(proofSetEntityId);
  if (!proofSet) {
    log.warning("handleRootsAdded: ProofSet {} not found for event tx {}", [
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
      "Decoded setId {} does not match event param {} in handleRootsAdded. Tx: {}. Using event param.",
      [
        decodedSetId.toString(),
        setId.toString(),
        event.transaction.hash.toHex(),
      ]
    );
  }

  // Decode rootsData (tuple[])
  let rootsDataOffset = readUint256(encodedData, 32).toI32(); // Offset is at byte 32
  let rootsDataLength: i32;

  if (rootsDataOffset < 0 || encodedData.length < rootsDataOffset + 32) {
    log.error(
      "handleRootsAdded: Invalid rootsDataOffset {} or data length {} for reading rootsData length. Tx: {}",
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
    log.error("handleRootsAdded: Invalid negative rootsDataLength {}. Tx: {}", [
      rootsDataLength.toString(),
      event.transaction.hash.toHex(),
    ]);
    return;
  }

  // Check if number of roots from input matches event param
  if (rootsDataLength != rootIdsFromEvent.length) {
    log.error(
      "handleRootsAdded: Decoded roots count ({}) does not match event param count ({}). Tx: {}",
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
        "handleRootsAdded: Encoded data too short or invalid offset for root struct content. Index: {}, Offset: {}, Len: {}. Tx: {}",
        [
          i.toString(),
          structDataAbsOffset.toString(),
          encodedData.length.toString(),
          event.transaction.hash.toHex(),
        ]
      );
      continue; // Skip this root
    }

    // Decode root tuple (bytes stored within the struct)
    const rootBytes = readBytes(encodedData, structDataAbsOffset); // Reads dynamic bytes
    // Decode rawSize (uint256 stored after root bytes offset)
    const rawSize = readUint256(encodedData, structDataAbsOffset + 32);

    const rootEntityId = getRootEntityId(setId, rootId);

    let root = Root.load(rootEntityId);
    if (root) {
      log.warning(
        "handleRootsAdded: Root {} for Set {} already exists. This shouldn't happen. Skipping.",
        [rootId.toString(), setId.toString()]
      );
      continue;
    }

    root = new Root(rootEntityId);
    root.rootId = rootId;
    root.setId = setId;
    root.rawSize = rawSize; // Use correct field name
    root.leafCount = rawSize.div(BigInt.fromI32(LeafSize));
    root.cid = rootBytes.length > 0 ? rootBytes : Bytes.empty(); // Use correct field name
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
    root.proofSet = proofSetEntityId; // Link to ProofSet

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

  // Update ProofSet stats
  proofSet.totalRoots = proofSet.totalRoots.plus(
    BigInt.fromI32(addedRootCount)
  ); // Use correct field name
  proofSet.nextRootId = proofSet.nextRootId.plus(
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
    log.warning("handleRootsAdded: Provider {} for ProofSet {} not found", [
      proofSet.owner.toHex(),
      setId.toString(),
    ]);
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

export function handleRootsRemoved(event: RootsRemovedEvent): void {
  const setId = event.params.setId;
  const rootIds = event.params.rootIds;

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
  eventLog.name = "RootsRemoved";
  // Store simple representation of event params
  let removedRootIdStrings: string[] = [];
  for (let i = 0; i < rootIds.length; i++) {
    removedRootIdStrings.push(rootIds[i].toString());
  }
  eventLog.data = `{ "setId": "${setId.toString()}", "rootIds": [${removedRootIdStrings.join(",")}] }`;
  eventLog.logIndex = event.logIndex;
  eventLog.transactionHash = event.transaction.hash;
  eventLog.createdAt = event.block.timestamp;
  eventLog.blockNumber = event.block.number;
  eventLog.proofSet = proofSetEntityId;
  eventLog.transaction = transactionEntityId;
  eventLog.save();

  // Load ProofSet
  const proofSet = ProofSet.load(proofSetEntityId);
  if (!proofSet) {
    log.warning("handleRootsRemoved: ProofSet {} not found for event tx {}", [
      setId.toString(),
      event.transaction.hash.toHex(),
    ]);
    return;
  }

  let removedRootCount = 0;
  let removedDataSize = BigInt.fromI32(0);

  // Mark Root entities as removed (soft delete)
  for (let i = 0; i < rootIds.length; i++) {
    const rootId = rootIds[i];
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
        proofSet.nextRootId.toI32(),
        rootId.toI32(),
        root.rawSize.div(BigInt.fromI32(LeafSize)),
        event.block.number
      );
    } else {
      log.warning(
        "handleRootsRemoved: Root {} for Set {} not found. Cannot remove.",
        [rootId.toString(), setId.toString()]
      );
    }
  }

  // Update ProofSet stats
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
      "handleRootsRemoved: ProofSet {} rootCount went negative. Setting to 0.",
      [setId.toString()]
    );
    proofSet.totalRoots = BigInt.fromI32(0); // Use correct field name
  }
  if (proofSet.totalDataSize.lt(BigInt.fromI32(0))) {
    log.warning(
      "handleRootsRemoved: ProofSet {} totalDataSize went negative. Setting to 0.",
      [setId.toString()]
    );
    proofSet.totalDataSize = BigInt.fromI32(0);
  }
  if (proofSet.leafCount.lt(BigInt.fromI32(0))) {
    log.warning(
      "handleRootsRemoved: ProofSet {} leafCount went negative. Setting to 0.",
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
        "handleRootsRemoved: Provider {} totalDataSize went negative. Setting to 0.",
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
        "handleRootsRemoved: Provider {} totalRoots went negative. Setting to 0.",
        [proofSet.owner.toHex()]
      );
      provider.totalRoots = BigInt.fromI32(0);
    }
    provider.updatedAt = event.block.timestamp;
    provider.blockNumber = event.block.number;
    provider.save();
  } else {
    log.warning("handleRootsRemoved: Provider {} for ProofSet {} not found", [
      proofSet.owner.toHex(),
      setId.toString(),
    ]);
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
