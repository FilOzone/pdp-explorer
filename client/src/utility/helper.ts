import cookie from 'js-cookie'

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
  dateString: string | null,
  showTime: boolean = true
) => {
  if (!dateString) return 'Never'
  return showTime
    ? new Date(dateString).toLocaleString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      })
    : new Date(dateString).toLocaleString('en-US', {
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
