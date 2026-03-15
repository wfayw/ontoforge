import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'ontoforge_theme';
const MQ = '(prefers-color-scheme: dark)';

function getInitialMode(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') {
    return window.matchMedia(MQ).matches ? 'dark' : 'light';
  }
  return mode;
}

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (m: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(getInitialMode()));

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    localStorage.setItem(STORAGE_KEY, m);
    setResolved(resolveTheme(m));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(MQ);
    const handler = () => {
      if (mode === 'system') setResolved(mq.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved);
  }, [resolved]);

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode, isDark: resolved === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
