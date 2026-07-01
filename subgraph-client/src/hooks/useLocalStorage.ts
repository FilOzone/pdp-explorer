import { useCallback, useEffect, useState } from "react";

/**
 * Custom hook to manage localStorage interactions.
 * @param key The key under which the value is stored in localStorage.
 * @param initialValue The initial value to use if the key is not present in localStorage.
 * @returns [storedValue, setValue] The current value and a function to update it.
 */
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key “${key}”: `, error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error(`Error setting localStorage key “${key}”: `, error);
    }
  }, [key, storedValue]);

  const setValue = useCallback((value: T) => {
    setStoredValue((prev) => (value instanceof Function ? value(prev) : value));
  }, []);

  return [storedValue, setValue];
}

export default useLocalStorage;
