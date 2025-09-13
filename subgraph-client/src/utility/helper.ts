import cookie from 'js-cookie'
import { CID } from 'multiformats/cid'

export const getLocalStorage = (key: string) => {
  if (window) {
    return localStorage.getItem(key)
  }
}
//set in localStorage
export const setLocalStorage = (key: string, value: string) => {
  if (window) {
    localStorage.setItem(key, JSON.stringify(value))
  }
}
//remove in localStorage
export const removeLocalStorage = (key: string) => {
  if (window) {
    localStorage.removeItem(key)
  }
}

//set in cookie
export const setcookie = (key: string, value: string) => {
  if (window) {
    cookie.set(key, value, {
      expires: 1,
    })
  }
}
//remove in cookie
export const removecookie = (key: string) => {
  if (window) {
    cookie.remove(key, {
      expires: 1,
    })
  }
}

//get cookie
export const getcookie = (key: string) => {
  if (window) {
    return cookie.get(key)
  }
}

//get data from localstorage
export const isAuth = () => {
  if (window) {
    return JSON.parse(localStorage.getItem('user') ?? '') ? true : false
  }
}

export const getLocalNotification = () => {
  if (window) {
    if (!localStorage.getItem('notification')) {
      return JSON.parse(localStorage.getItem('notification') ?? '')
    } else {
      return false
    }
  }
}
//store token and user data in storage
export const authenticate = (response: { data: string }) => {
  setLocalStorage('user', response.data)

  const expirationDate = new Date(
    new Date().getTime() + 60 * 60 * 24 * 10 * 1000
  )
  setLocalStorage('expirationDate', expirationDate.toDateString())
}

// Format date for display
export const formatDate = (
  timestamp: string | number | null,
  showTime: boolean = false
) => {
  if (!timestamp) return 'Never'
  return showTime
    ? new Date(Number(timestamp) * 1000).toLocaleString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      })
    : new Date(Number(timestamp) * 1000).toLocaleString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
}

// Format file size for display
export function formatDataSize(size: number | string) {
  size = Number(size)
  const i = size === 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024))
  const sizes = ['B', 'KB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']
  return `${(size / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`
}

export const formatTokenAmount = (attoFil: string) => {
  if (!attoFil || attoFil === '0') return '0 FIL'

  const units = [
    { name: 'FIL', decimals: 18 },
    { name: 'milliFIL', decimals: 15 },
    { name: 'microFIL', decimals: 12 },
    { name: 'nanoFIL', decimals: 9 },
    { name: 'picoFIL', decimals: 6 },
    { name: 'femtoFIL', decimals: 3 },
    { name: 'attoFIL', decimals: 0 },
  ]

  const value = BigInt(attoFil)

  for (const unit of units) {
    const divisor = BigInt(10) ** BigInt(unit.decimals)
    const unitValue = Number(value) / Number(divisor)

    if (unitValue >= 1) {
      const decimals = unit.name === 'FIL' ? 4 : 2
      return `${unitValue.toFixed(decimals)} ${unit.name}`
    }
  }

  return '0 FIL'
}

// Convert hex string (without 0x prefix) to Uint8Array
export const hexToBytes = (hex: string): Uint8Array => {
  // remove 0x prefix if present
  hex = hex.replace(/^0x/, '')
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

export function bytesToHex(bytes: Uint8Array): `0x${string}` {
  return ('0x' +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')) as `0x${string}`
}

export function decodeWeekIdAndProviderId(concatBytes: Uint8Array) {
  const weekIdBytes = concatBytes.slice(0, 4)
  const providerIdBytes = concatBytes.slice(4)
  const weekId =
    weekIdBytes[0] |
    (weekIdBytes[1] << 8) |
    (weekIdBytes[2] << 16) |
    (weekIdBytes[3] << 24)
  return { weekId, providerId: bytesToHex(providerIdBytes) }
}

export function decodeWeekIdAndProofSetId(concatBytes: Uint8Array) {
  const weekIdBytes = concatBytes.slice(0, 4)
  const proofSetBytes = concatBytes.slice(4)
  const weekId =
    weekIdBytes[0] |
    (weekIdBytes[1] << 8) |
    (weekIdBytes[2] << 16) |
    (weekIdBytes[3] << 24)
  return { weekId, dataSetId: bytesToHex(proofSetBytes) }
}

export function normalizeBytesFilter(input: string): string {
  let hex = input.startsWith('0x') ? input.slice(2) : input
  if (hex.length % 2 !== 0) {
    hex = '0' + hex
  }
  hex = hex.toLowerCase()
  return '0x' + hex
}

export function decodeRootCid(hexBytes: string): string {
  const cidBytes = hexToBytes(hexBytes)
  return CID.decode(cidBytes).toString()
}

export function parseRootCidToHex(rootCid: string): `0x${string}` | null {
  // rootCid must start with "baga6ea4seaq"
  if (!rootCid.startsWith('baga6ea4seaq')) {
    return null
  }
  const cid = CID.parse(rootCid)
  return bytesToHex(cid.bytes)
}
