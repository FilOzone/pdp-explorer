import { BigInt, Bytes } from "@graphprotocol/graph-ts";

export function getProofSetEntityId(setId: BigInt): Bytes {
  return Bytes.fromByteArray(Bytes.fromBigInt(setId));
}

export function getRootEntityId(setId: BigInt, rootId: BigInt): Bytes {
  return Bytes.fromUTF8(`${setId.toString()}-${rootId.toString()}`);
}

// Distinguishes methods and datasets executed within the same transaction.
export function getTransactionEntityId(txHash: Bytes, dataSetId: BigInt, method: string): Bytes {
  return Bytes.fromUTF8(`${txHash.toHex()}-${dataSetId.toString()}-${method}`);
}

export function getEventLogEntityId(txHash: Bytes, logIndex: BigInt): Bytes {
  return txHash.concatI32(logIndex.toI32());
}

export function getServiceProviderLinkEntityId(serviceAddr: Bytes, providerAddr: Bytes): Bytes {
  return serviceAddr.concat(providerAddr);
}
