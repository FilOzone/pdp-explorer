import { useState, useEffect } from 'react'
import { useDebounce } from './useDebounce'

// Validate if the search input is a valid number (BigInt)
const isValidNumber = (input: string): boolean => {
  // Empty string is valid (no search)
  if (!input) return true
  // Check if it's a valid number
  return /^\d+$/.test(input)
}

export function useValidatedNumberDebounce(value: string, delay: number) {
  const [searchError, setSearchError] = useState<string | null>(null)
  const debouncedSearch = useDebounce(value, delay)

  // Check if search is a valid number
  useEffect(() => {
    if (!debouncedSearch) {
      setSearchError(null)
      return
    }

    if (!isValidNumber(debouncedSearch)) {
      setSearchError('Please enter a valid numeric ID')
      return
    }

    setSearchError(null)
  }, [debouncedSearch])

  const validatedSearch = debouncedSearch && !searchError ? debouncedSearch : ''

  return {
    searchError,
    setSearchError,
    debouncedSearch,
    validatedSearch,
  }
}
