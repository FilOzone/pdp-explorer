import {
  BigInt,
  Bytes,
  Value,
  log,
  store,
  Entity,
} from "@graphprotocol/graph-ts";
import { NetworkMetric } from "../generated/schema";

export function saveNetworkMetrics(
  keys: string[],
  values: BigInt[],
  methods?: string[]
): void {
  const networkMetric = NetworkMetric.load(Bytes.fromUTF8("pdp_network_stats"));

  if (networkMetric) {
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = values[i];
      const method = methods ? methods[i] : "add";

      const valueToChangeValue = networkMetric.get(key);
      let valueToChange = BigInt.fromI32(0);
      if (valueToChangeValue) {
        valueToChange = valueToChangeValue.toBigInt();
      }
      if (method == "add") {
        networkMetric.set(key, Value.fromBigInt(valueToChange.plus(value)));
      } else if (method == "subtract") {
        networkMetric.set(key, Value.fromBigInt(valueToChange.minus(value)));
      } else {
        networkMetric.set(key, Value.fromBigInt(valueToChange.plus(value)));
      }
    }
    networkMetric.save();
  } else {
    const networkMetric = new NetworkMetric(
      Bytes.fromUTF8("pdp_network_stats")
    );
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = values[i];
      const method = methods ? methods[i] : "add";

      let valueToAdd = BigInt.fromI32(0);
      if (method == "add") {
        valueToAdd = value;
      } else if (method == "subtract") {
        valueToAdd = BigInt.fromI32(0);
      } else {
        valueToAdd = value;
      }

      networkMetric.set(key, Value.fromBigInt(valueToAdd));
    }
    networkMetric.save();
  }
}

export function saveProviderMetrics(
  entity: string,
  id: Bytes,
  providerId: Bytes,
  keys: string[],
  values: BigInt[],
  methods?: string[]
): void {
  const availableEntities = [
    "WeeklyProviderActivity",
    "MonthlyProviderActivity",
  ];
  if (!availableEntities.includes(entity)) {
    log.error("Invalid entity: {}", [entity]);
    return;
  }

  const entityInstance = store.get(entity, id.toHexString());
  if (entityInstance) {
    entityInstance.set("providerId", Value.fromBytes(providerId));
    entityInstance.set("provider", Value.fromBytes(providerId));
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = values[i];
      const method = methods ? methods[i] : "add";

      const valueToChangeValue = entityInstance.get(key);
      let valueToChange = BigInt.fromI32(0);
      if (valueToChangeValue) {
        valueToChange = valueToChangeValue.toBigInt();
      }
      if (method == "replace") {
        entityInstance.set(key, Value.fromBigInt(value));
      } else if (method == "add") {
        entityInstance.set(key, Value.fromBigInt(valueToChange.plus(value)));
      } else if (method == "subtract") {
        entityInstance.set(key, Value.fromBigInt(valueToChange.minus(value)));
      } else {
        entityInstance.set(key, Value.fromBigInt(valueToChange.plus(value)));
      }
    }
    store.set(entity, id.toHexString(), entityInstance);
  } else {
    let requiredKeys = [
      "totalRootsAdded",
      "totalDataSizeAdded",
      "totalProofSetsCreated",
      "totalProofs",
      "totalRootsProved",
      "totalFaultedRoots",
      "totalFaultedPeriods",
      "totalRootsRemoved",
      "totalDataSizeRemoved",
    ];
    const entityInstance = new Entity();
    entityInstance.set("providerId", Value.fromBytes(providerId));
    entityInstance.set("provider", Value.fromBytes(providerId));
    for (let i = 0; i < requiredKeys.length; i++) {
      entityInstance.set(requiredKeys[i], Value.fromBigInt(BigInt.fromI32(0)));
    }

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = values[i];
      const method = methods ? methods[i] : "add";

      const valueToChangeValue = entityInstance.get(key);
      let valueToChange = BigInt.fromI32(0);
      if (valueToChangeValue) {
        valueToChange = valueToChangeValue.toBigInt();
      }
      if (method == "replace") {
        entityInstance.set(key, Value.fromBigInt(value));
      } else if (method == "add") {
        entityInstance.set(key, Value.fromBigInt(valueToChange.plus(value)));
      } else if (method == "subtract") {
        entityInstance.set(key, Value.fromBigInt(valueToChange.minus(value)));
      } else {
        entityInstance.set(key, Value.fromBigInt(valueToChange.plus(value)));
      }
    }
    store.set(entity, id.toHexString(), entityInstance);
  }
}

export function saveProofSetMetrics(
  entity: string,
  id: Bytes,
  proofSetId: BigInt,
  keys: string[],
  values: BigInt[],
  methods?: string[]
): void {
  const availableEntities = [
    "WeeklyProofSetActivity",
    "MonthlyProofSetActivity",
  ];
  if (!availableEntities.includes(entity)) {
    log.error("Invalid entity: {}", [entity]);
    return;
  }

  const entityInstance = store.get(entity, id.toHexString());

  if (entityInstance) {
    entityInstance.set("proofSetId", Value.fromBigInt(proofSetId));
    entityInstance.set(
      "proofSet",
      Value.fromBytes(Bytes.fromByteArray(Bytes.fromBigInt(proofSetId)))
    );
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = values[i];
      const method = methods ? methods[i] : "add";

      const valueToChangeValue = entityInstance.get(key);
      let valueToChange = BigInt.fromI32(0);
      if (valueToChangeValue) {
        valueToChange = valueToChangeValue.toBigInt();
      }
      if (method == "replace") {
        entityInstance.set(key, Value.fromBigInt(value));
      } else if (method == "add") {
        entityInstance.set(key, Value.fromBigInt(valueToChange.plus(value)));
      } else if (method == "subtract") {
        entityInstance.set(key, Value.fromBigInt(valueToChange.minus(value)));
      } else {
        entityInstance.set(key, Value.fromBigInt(valueToChange.plus(value)));
      }
    }
    store.set(entity, id.toHexString(), entityInstance);
  } else {
    let requiredKeys = [
      "totalRootsAdded",
      "totalDataSizeAdded",
      "totalProofs",
      "totalRootsProved",
      "totalFaultedRoots",
      "totalFaultedPeriods",
      "totalRootsRemoved",
      "totalDataSizeRemoved",
    ];
    const entityInstance = new Entity();
    entityInstance.set("proofSetId", Value.fromBigInt(proofSetId));
    entityInstance.set(
      "proofSet",
      Value.fromBytes(Bytes.fromByteArray(Bytes.fromBigInt(proofSetId)))
    );
    for (let i = 0; i < requiredKeys.length; i++) {
      entityInstance.set(requiredKeys[i], Value.fromBigInt(BigInt.fromI32(0)));
    }

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = values[i];
      const method = methods ? methods[i] : "add";

      const valueToChangeValue = entityInstance.get(key);
      let valueToChange = BigInt.fromI32(0);
      if (valueToChangeValue) {
        valueToChange = valueToChangeValue.toBigInt();
      }
      if (method == "replace") {
        entityInstance.set(key, Value.fromBigInt(value));
      } else if (method == "add") {
        entityInstance.set(key, Value.fromBigInt(valueToChange.plus(value)));
      } else if (method == "subtract") {
        entityInstance.set(key, Value.fromBigInt(valueToChange.minus(value)));
      } else {
        entityInstance.set(key, Value.fromBigInt(valueToChange.plus(value)));
      }
    }
    store.set(entity, id.toHexString(), entityInstance);
  }
}
