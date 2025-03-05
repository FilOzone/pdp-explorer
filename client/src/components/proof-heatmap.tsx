import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Roots } from '@/api/apiService'

// ProofHeatMap component to display the 7-day proving heat map
const ProofHeatMap = ({ roots }: { roots: Roots[] }) => {
  // Function to determine the status of a root
  const getRootStatus = (root: Roots) => {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const lastProvenDate = root.lastProvenAt
      ? new Date(root.lastProvenAt)
      : null
    const lastFaultedDate = root.lastFaultedAt
      ? new Date(root.lastFaultedAt)
      : null

    // Root was challenged and faulted in the last 7 days
    if (lastFaultedDate && lastFaultedDate >= sevenDaysAgo) {
      // If it was also proven successfully after the fault, it's successful
      if (lastProvenDate && lastProvenDate > lastFaultedDate) {
        return 'success'
      }
      return 'fault'
    }

    // Root was challenged and proven successfully in the last 7 days
    if (lastProvenDate && lastProvenDate >= sevenDaysAgo) {
      return 'success'
    }

    // Root exists but was not challenged in the last 7 days
    return 'unchallenged'
  }

  // Filter roots that are not removed
  const activeRoots = roots.filter((root) => !root.removed)

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
  }

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-4">
        {activeRoots.map((root) => {
          const status = getRootStatus(root)
          let bgColor = ''

          switch (status) {
            case 'success':
              bgColor = 'bg-green-500'
              break
            case 'fault':
              bgColor = 'bg-red-500'
              break
            case 'unchallenged':
              bgColor = 'bg-white border border-gray-300'
              break
          }

          return (
            <Tooltip key={root.rootId}>
              <TooltipTrigger>
                <div
                  className={`w-8 h-8 ${bgColor} rounded cursor-pointer`}
                  aria-label={`Root ID: ${root.rootId}`}
                />
              </TooltipTrigger>
              <TooltipContent className="p-2">
                <div className="space-y-1">
                  <p className="font-semibold">Root ID: {root.rootId}</p>
                  <p className="text-xs truncated">CID: {root.cid}</p>
                  <p className="text-xs">
                    Total Proofs: {root.totalProofsSubmitted}
                  </p>
                  <p className="text-xs">
                    Total Faulted Periods: {root.totalPeriodsFaulted}
                  </p>
                  <p className="text-xs">
                    Last Proven: {formatDate(root.lastProvenAt)}
                  </p>
                  <p className="text-xs">
                    Last Faulted: {formatDate(root.lastFaultedAt)}
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

export default ProofHeatMap
