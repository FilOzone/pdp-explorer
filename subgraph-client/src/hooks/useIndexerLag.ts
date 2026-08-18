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
  lagSeconds: number;
  isDelayed: boolean;
  hasIndexingErrors: boolean;
  blockNumber?: number;
}

/**
 * Compares the subgraph's indexed block timestamp against wall-clock time to
 * detect when the indexer has fallen behind the chain tip. Every Graph Node
 * deployment exposes `_meta.block.timestamp` for free, so this needs no RPC call.
 */
export function useIndexerLag(): IndexerLagStatus | null {
  const { network } = useNetwork();
  const { data } = useGraphQL<IndexerMetaResponse>(indexerMetaQuery, undefined, {
    revalidateOnFocus: true,
    refreshInterval: POLL_INTERVAL_MS,
  });

  const meta = data?._meta;
  if (!meta) {
    return null;
  }

  const lagSeconds = Math.max(0, Math.floor(Date.now() / 1000 - meta.block.timestamp));

  return {
    network,
    lagSeconds,
    isDelayed: lagSeconds >= INDEXER_LAG_THRESHOLD_SECONDS,
    hasIndexingErrors: meta.hasIndexingErrors,
    blockNumber: meta.block.number,
  };
}

export default useIndexerLag;
