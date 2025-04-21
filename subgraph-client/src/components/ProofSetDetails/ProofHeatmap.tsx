import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { type Root } from '@/utility/types'
import { formatDate, hexToBytes } from '@/utility/helper'
import { useMemo } from 'react'
import { CID } from 'multiformats/cid'

const ProofHeatmap = ({ roots }: { roots: Root[] }) => {
  const calculateRootHealthScore = (root: Root) => {
    const totalProofs = Number(root.totalProofsSubmitted) || 0
    const totalFaults = Number(root.totalPeriodsFaulted) || 0

    if (totalProofs === 0 && totalFaults === 0) {
      return { status: 'unchallenged', score: 0 }
    }

    if (totalProofs === 0 && totalFaults > 0) {
      return { status: 'fault', score: 0 }
    }

    if (totalProofs > 0 && totalFaults === 0) {
      return { status: 'success', score: 1 }
    }

    const score = totalProofs / (totalProofs + totalFaults)

    let status = 'mixed'
    if (score >= 0.8) status = 'success'
    else if (score <= 0.2) status = 'fault'

    return { status, score }
  }

  const activeRoots = roots.filter((root) => !root.removed)

  const getColorFromScore = useMemo(() => {
    return (score: number, status: string) => {
      if (status === 'unchallenged') return 'rgb(255, 255, 255)'

      const r = score <= 0.2 ? 255 : Math.round(255 * (1 - (score - 0.5) * 2))
      const g = score <= 0.8 ? Math.round(255 * score * 2) : 255

      return `rgb(${r}, ${g}, 0)`
    }
  }, [])

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-4">
        {activeRoots.map((root) => {
          const { status, score } = calculateRootHealthScore(root)
          const healthPercentage = Math.round(score * 100)

          return (
            <Tooltip key={root.rootId}>
              <TooltipTrigger>
                <div
                  className={`w-8 h-8 rounded cursor-pointer ${
                    score === 0 ? 'border border-gray-300' : ''
                  }`}
                  aria-label={`Root ID: ${root.rootId}`}
                  style={{
                    backgroundColor: getColorFromScore(score, status),
                  }}
                />
              </TooltipTrigger>
              <TooltipContent className="p-2">
                <div className="space-y-1">
                  <p className="font-semibold">Root ID: {root.rootId}</p>
                  <p className="text-xs truncated">
                    CID: {CID.decode(hexToBytes(root.cid)).toString()}
                  </p>
                  <p className="text-xs">
                    Total Proofs: {root.totalProofsSubmitted}
                  </p>
                  <p className="text-xs">
                    Total Faulted Periods: {root.totalPeriodsFaulted}
                  </p>
                  {status !== 'unchallenged' && (
                    <p className="text-xs font-medium">
                      Health Score: {healthPercentage}%
                    </p>
                  )}
                  <p className="text-xs">
                    Last Proven:{' '}
                    {root.lastProvenAt !== '0'
                      ? formatDate(root.lastProvenAt)
                      : 'Never'}
                  </p>
                  <p className="text-xs">
                    Last Faulted:{' '}
                    {root.lastFaultedAt !== '0'
                      ? formatDate(root.lastFaultedAt)
                      : 'Never'}
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          )
        })}
        {activeRoots.length === 0 && (
          <div className="col-span-full text-center py-4 text-gray-500">
            No active roots found.
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

export default ProofHeatmap
