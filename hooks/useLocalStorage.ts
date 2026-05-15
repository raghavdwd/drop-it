/*
 * useLocalStorage — A custom React hook for persisting state in localStorage.
 * ===========================================================================
 * This hook mirrors the API of React's useState() but persists the value
 * to the browser's localStorage under the given key.
 *
 * Why use this instead of raw localStorage?
 *   - Automatically syncs state across the React lifecycle.
 *   - Handles JSON serialization/deserialization internally.
 *   - SSR-safe: bails out when `window` is undefined (Next.js server render).
 *   - Graceful error handling if localStorage is unavailable (private browsing,
 *     storage quota exceeded, etc.).
 *
 * Usage:
 *   const [name, setName] = useLocalStorage("user-name", "Guest");
 *   // "user-name" key is created in localStorage with value '"Guest"'
 *   // After setName("Alice"), localStorage reads: "Alice"
 */

import { useState } from "react";

export const useLocalStorage = <T>(
  key: string,
  initialValue: T,
): [T, (value: T) => void] => {
  /*
   * Lazy initializer — the function passed to useState() runs only once,
   * on the initial render. This avoids reading localStorage on every render.
   *
   * We check `typeof window === "undefined"` first for SSR compatibility.
   * During server-side rendering, there is no localStorage, so we return
   * the initialValue and let the client pick up the persisted value on
   * hydration.
   */
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error("Error reading localStorage key:", key, error);
      return initialValue;
    }
  });

  /*
   * setValue — Updates both React state AND localStorage.
   * This ensures the change is visible immediately AND survives page reloads.
   */
  const setValue = (value: T) => {
    try {
      setStoredValue(value);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      console.error("Error setting localStorage key:", key, error);
    }
  };

  return [storedValue, setValue];
};
