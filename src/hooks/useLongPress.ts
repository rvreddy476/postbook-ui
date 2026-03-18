import { useRef, useCallback } from 'react';

export function useLongPress(onLongPress: () => void, threshold = 600) {
  const timerRef = useRef<NodeJS.Timeout>(undefined);
  return {
    onPointerDown: useCallback(() => {
      timerRef.current = setTimeout(onLongPress, threshold);
    }, [onLongPress, threshold]),
    onPointerUp: useCallback(() => clearTimeout(timerRef.current), []),
    onPointerLeave: useCallback(() => clearTimeout(timerRef.current), []),
  };
}
