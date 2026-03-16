import { useState, useEffect, useCallback, useRef } from 'react';

interface UseAutoRefreshReturn {
  secondsLeft: number;
  isAutoRefresh: boolean;
  setAutoRefresh: (on: boolean) => void;
  manualRefresh: () => void;
}

export function useAutoRefresh(
  fetchFn: () => Promise<void> | void,
  intervalMs = 30_000,
): UseAutoRefreshReturn {
  const [isAutoRefresh, setAutoRefresh] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(intervalMs / 1000));
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  const manualRefresh = useCallback(() => {
    setSecondsLeft(Math.floor(intervalMs / 1000));
    fetchRef.current();
  }, [intervalMs]);

  useEffect(() => {
    if (!isAutoRefresh) return;

    setSecondsLeft(Math.floor(intervalMs / 1000));
    const countdown = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          fetchRef.current();
          return Math.floor(intervalMs / 1000);
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdown);
  }, [isAutoRefresh, intervalMs]);

  return { secondsLeft, isAutoRefresh, setAutoRefresh, manualRefresh };
}
