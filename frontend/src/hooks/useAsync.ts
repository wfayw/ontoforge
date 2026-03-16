import { useState, useCallback, useEffect, useRef } from 'react';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

interface UseAsyncReturn<T> extends AsyncState<T> {
  refresh: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

export function useAsync<T>(
  asyncFn: () => Promise<T>,
  deps: unknown[] = [],
  immediate = true,
): UseAsyncReturn<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: immediate,
    error: null,
  });
  const mountedRef = useRef(true);

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const result = await asyncFn();
      if (mountedRef.current) {
        setState({ data: result, loading: false, error: null });
      }
    } catch (err) {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, loading: false, error: err as Error }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    if (immediate) execute();
    return () => { mountedRef.current = false; };
  }, [execute, immediate]);

  const setData = useCallback<React.Dispatch<React.SetStateAction<T | null>>>(
    (value) => setState(prev => ({
      ...prev,
      data: typeof value === 'function' ? (value as (prev: T | null) => T | null)(prev.data) : value,
    })),
    [],
  );

  return { ...state, refresh: execute, setData };
}
