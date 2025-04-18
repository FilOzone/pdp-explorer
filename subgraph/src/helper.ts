import { BigInt, Bytes, Value } from "@graphprotocol/graph-ts";
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
