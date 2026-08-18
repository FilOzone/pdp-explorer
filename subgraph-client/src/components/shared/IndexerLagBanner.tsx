import { AlertTriangle, Clock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useIndexerLag } from "@/hooks/useIndexerLag";

function formatLag(seconds: number): string {
  if (seconds < 3600) {
    const minutes = Math.max(1, Math.round(seconds / 60));
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}${minutes ? ` ${minutes} minute${minutes === 1 ? "" : "s"}` : ""}`;
}

export const IndexerLagBanner = () => {
  const status = useIndexerLag();

  if (!status) return null;

  if (status.hasIndexingErrors) {
    return (
      <div className="max-w-7xl mx-auto px-6 pt-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Indexer reporting errors</AlertTitle>
          <AlertDescription>
            The {status.network} indexer is reporting errors. Data on this page may be incomplete or out of date.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (status.isDelayed) {
    return (
      <div className="max-w-7xl mx-auto px-6 pt-4">
        <Alert variant="warning">
          <Clock className="h-4 w-4" />
          <AlertTitle>Data may be delayed</AlertTitle>
          <AlertDescription>
            The {status.network} indexer is about {formatLag(status.lagSeconds)} behind the chain tip. Recent activity
            may not be reflected yet.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return null;
};

export default IndexerLagBanner;
