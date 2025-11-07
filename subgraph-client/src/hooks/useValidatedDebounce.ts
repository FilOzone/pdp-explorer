import { useState, useEffect } from 'react'
import { useDebounce } from './useDebounce'

// Validate if the search input is a valid hex string
const isValidHex = (input: string): boolean => {
  // Empty string is valid (no search)
  if (!input) return true
  // Check if it's a valid hex string (with or without 0x prefix)
  const hexRegex = /^(0x)?[0-9a-fA-F]+$/
  return hexRegex.test(input)
}

export function useValidatedDebounce(value: string, delay: number) {
  const [searchError, setSearchError] = useState<string | null>(null)
  const debouncedSearch = useDebounce(value, delay)

  // Check if search is valid hex and has even length (after removing 0x prefix)
  useEffect(() => {
    if (!debouncedSearch) {
      setSearchError(null)
      return
    }

    if (!isValidHex(debouncedSearch)) {
      setSearchError('Please enter a valid hexadecimal address')
      return
    }

    const hex = debouncedSearch.startsWith('0x')
      ? debouncedSearch.slice(2)
      : debouncedSearch
    if (hex.length % 2 !== 0) {
      setSearchError('Address must have an even number of characters')
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
