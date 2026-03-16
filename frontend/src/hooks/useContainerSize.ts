import { useState, useEffect, useRef } from 'react';

interface Size {
  width: number;
  height: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useContainerSize<T extends HTMLElement = HTMLDivElement>(): [React.RefObject<any>, Size] {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) {
        setSize({
          width: Math.floor(entry.contentRect.width),
          height: Math.floor(entry.contentRect.height),
        });
      }
    });

    observer.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });

    return () => observer.disconnect();
  }, []);

  return [ref, size];
}
