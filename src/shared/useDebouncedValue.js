import { useEffect, useState } from "react";

export function useDebouncedValue(value, wait = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = globalThis.setTimeout(() => {
      setDebounced(value);
    }, wait);

    return () => globalThis.clearTimeout(timer);
  }, [value, wait]);

  return debounced;
}
