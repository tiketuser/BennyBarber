import { useState } from 'react';

/**
 * Runs `fn` during render whenever `value` changes, e.g. to reset a form when its sheet opens.
 * React's "adjust state when a prop changes" pattern: no effect, so no extra render with stale state.
 */
export function useOnChange<T>(value: T, fn: (value: T) => void) {
  const [prev, setPrev] = useState(value);
  if (!Object.is(prev, value)) {
    setPrev(value);
    fn(value);
  }
}
