import { useCallback, useState } from 'react';

/** Like useState, but remembered in the browser (for harmless preferences only, never secrets). */
export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const set = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          /* storage may be full or blocked: the value still works for this visit */
        }
        return resolved;
      });
    },
    [key]
  );
  return [value, set];
}