import { useNetwork } from "@/contexts/NetworkContext";
import { indexerMetaQuery } from "@/utility/queries";
import useGraphQL from "./useGraphQL";

export const INDEXER_LAG_THRESHOLD_SECONDS = 5 * 60;
const POLL_INTERVAL_MS = 60_000;

interface IndexerMetaResponse {
  _meta: {
    block: {
      number: number;
      timestamp: number;
    };
    hasIndexingErrors: boolean;
  };
}

export interface IndexerLagStatus {
  network: string;
  isUnavailable: boolean;
  lagSeconds: number;
  isDelayed: boolean;
  hasIndexingErrors: boolean;
  blockNumber?: number;
}

/**
 * Compares the subgraph's indexed block timestamp against wall-clock time to
 * estimate how stale the indexed data is. Every Graph Node deployment exposes
 * `_meta.block.timestamp` for free, so this needs no RPC call. This is a proxy
 * for "indexer behind the chain": it can't distinguish a lagging indexer from
 * the chain itself stalling, and it trusts the client's local clock.
 * Returns `null` only while the initial query is still in flight.
 */
export function useIndexerLag(): IndexerLagStatus | null {
  const { network } = useNetwork();
  const { data, error } = useGraphQL<IndexerMetaResponse>(indexerMetaQuery, undefined, {
    revalidateOnFocus: true,
    refreshInterval: POLL_INTERVAL_MS,
  });

  if (error) {
    return {
      network,
      isUnavailable: true,
      lagSeconds: 0,
      isDelayed: false,
      hasIndexingErrors: false,
    };
  }

  const meta = data?._meta;
  if (!meta) {
    return null;
  }

  const lagSeconds = Math.max(0, Math.floor(Date.now() / 1000 - meta.block.timestamp));

  return {
    network,
    isUnavailable: false,
    lagSeconds,
    isDelayed: lagSeconds >= INDEXER_LAG_THRESHOLD_SECONDS,
    hasIndexingErrors: meta.hasIndexingErrors,
    blockNumber: meta.block.number,
  };
}

export default useIndexerLag;
