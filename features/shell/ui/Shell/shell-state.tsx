'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { ShellState } from './shell-types';

const ShellStateContext = createContext<ShellState | null>(null);

export function ShellStateProvider({ value, children }: { value: ShellState; children: ReactNode }) {
  return <ShellStateContext.Provider value={value}>{children}</ShellStateContext.Provider>;
}

export function useShellState(): ShellState {
  const state = useContext(ShellStateContext);
  if (!state) {
    throw new Error('Shell islands require ShellRuntime or ShellView');
  }
  return state;
}
