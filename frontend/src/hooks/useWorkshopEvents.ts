import { useState, useCallback, useRef } from 'react';

export type VariableMap = Record<string, string>;
type Listener = () => void;

export interface WorkshopEventBus {
  variables: VariableMap;
  setVariable: (name: string, value: string) => void;
  resetVariables: (defaults: VariableMap) => void;
  subscribe: (listener: Listener) => () => void;
  version: number;
}

export function useWorkshopEvents(initialVars: VariableMap = {}): WorkshopEventBus {
  const [variables, setVariables] = useState<VariableMap>(initialVars);
  const [version, setVersion] = useState(0);
  const listenersRef = useRef<Set<Listener>>(new Set());

  const notify = useCallback(() => {
    setVersion(v => v + 1);
    listenersRef.current.forEach(fn => fn());
  }, []);

  const setVariable = useCallback((name: string, value: string) => {
    setVariables(prev => {
      if (prev[name] === value) return prev;
      return { ...prev, [name]: value };
    });
    notify();
  }, [notify]);

  const resetVariables = useCallback((defaults: VariableMap) => {
    setVariables(defaults);
    notify();
  }, [notify]);

  const subscribe = useCallback((listener: Listener) => {
    listenersRef.current.add(listener);
    return () => { listenersRef.current.delete(listener); };
  }, []);

  return { variables, setVariable, resetVariables, subscribe, version };
}
