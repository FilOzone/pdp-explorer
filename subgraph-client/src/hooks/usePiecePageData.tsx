import { useEffect, useState } from 'react'
import { parseCidToHex } from '@/utility/helper'
import useGraphQL from './useGraphQL'
import { pieceDetailsQuery } from '@/utility/queries'
import type { RootData } from '@/utility/types'

interface PiecePageOptions {
  activityLimit?: number
  retryOnError?: boolean
}

const BATCH_SIZE = 1000

export function usePiecePageData(
  pieceId: string | undefined,
  options: PiecePageOptions = {}
) {
  const isValidPieceId = parseCidToHex(pieceId || '') !== null
  const [allRoots, setAllRoots] = useState<RootData[]>([])
  const [batchIndex, setBatchIndex] = useState(0)
  const [isCompleted, setIsCompleted] = useState(false)
  const prevPieceIdRef = useRef<string | undefined>(undefined)

  // Fetch current batch
  const {
    data: dataBatch,
    error: batchError,
    isLoading: batchLoading,
  } = useGraphQL<{ roots: RootData[] }>(
    pieceDetailsQuery,
    {
      cid: isValidPieceId ? hexCid : '',
      first: BATCH_SIZE,
      skip: batchIndex * BATCH_SIZE,
    },
    {
      errorRetryCount: options.retryOnError ? 3 : 0,
      revalidateOnFocus: false,
    }
  )

  // Handle batch results and check if we need more
  useEffect(() => {
    if (dataBatch?.roots && !isCompleted) {
      const newRoots = dataBatch.roots
      setAllRoots((prev) => [...prev, ...newRoots])

      // If this batch has fewer than BATCH_SIZE items, we're done
      if (newRoots.length < BATCH_SIZE) {
        setIsCompleted(true)
      } else {
        // Request next batch
        setBatchIndex((prev) => prev + 1)
      }
    }
  }, [dataBatch, isCompleted])

  // Reset on cid change, or force reset if pieceId is valid and has changed
  useEffect(() => {
    if (pieceId !== prevPieceIdRef.current) {
      setAllRoots([])
      setBatchIndex(0)
      setIsCompleted(false)
      prevPieceIdRef.current = pieceId
    }
  }, [pieceId])

  // Deduplicate by setId in O(n) time using a Set
  const seenSetIds = new Set<string>()
  const pieceDetails = allRoots.filter((rootData) => {
    if (seenSetIds.has(rootData.setId)) {
      return false
    }
    seenSetIds.add(rootData.setId)
    return true
  })

  const totalProofSets = pieceDetails.length
  const isLoading = batchLoading && batchIndex === 0 // Only show loading on first batch

  return {
    pieceDetails,
    totalProofSets,
    isValidPieceId,
    isLoading: {
      details: isLoading,
      any: isLoading,
    },
    errors: {
      details: batchError,
      any: batchError,
    },
  }
}

export default usePiecePageData
