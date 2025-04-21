import React from 'react'
import { Root } from '@/utility/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import ProofHeatmap from '@/components/ProofSetDetails/ProofHeatmap'

interface HeatmapSectionProps {
  heatmapRoots: Root[]
  totalRoots: number
  isLoading: boolean
  error: any
  isHeatmapExpanded: boolean
  setIsHeatmapExpanded: (expanded: boolean) => void
}

export const HeatmapSection: React.FC<HeatmapSectionProps> = ({
  heatmapRoots,
  totalRoots,
  isLoading,
  error,
  isHeatmapExpanded,
  setIsHeatmapExpanded,
}) => {
  return (
    <Collapsible open={isHeatmapExpanded} onOpenChange={setIsHeatmapExpanded}>
      <div className="p-4 border rounded">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            Historical Proving Heat Map
            {!isLoading && !error && (
              <span className="ml-2 text-sm text-gray-500 font-normal">
                ({heatmapRoots.length} of {totalRoots} roots shown)
              </span>
            )}
          </h2>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-9 p-0">
              {isHeatmapExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              <span className="sr-only">Toggle Heatmap</span>
            </Button>
          </CollapsibleTrigger>
        </div>

        {/* Legend */}
        <div className="flex gap-4 mb-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-200 rounded-sm"></div>
            <span className="text-sm">Not proven yet</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
            <span className="text-sm">Proven</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
            <span className="text-sm">Faulted proof</span>
          </div>
        </div>

        {/* Heatmap Display */}
        {isLoading ? (
          <HeatmapSkeleton />
        ) : error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Loading Heatmap</AlertTitle>
            <AlertDescription>
              Could not load heatmap data. Error:{' '}
              {error.message || 'Unknown error'}
            </AlertDescription>
          </Alert>
        ) : (
          <ProofHeatmap roots={heatmapRoots} />
        )}

        {/* Collapsible content for 'show all' message */}
        <CollapsibleContent>
          {!isLoading &&
            heatmapRoots.length < totalRoots &&
            isHeatmapExpanded && (
              <div className="mt-4 text-center text-sm text-gray-500">
                Showing all {totalRoots} roots from the last 7 days.
              </div>
            )}
          {!isLoading && heatmapRoots.length === 0 && !error && (
            <div className="mt-4 text-center text-sm text-gray-500">
              No root data available for the heatmap.
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

const HeatmapSkeleton: React.FC = () => (
  <div className="h-40 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500"></div>
  </div>
)
