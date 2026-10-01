'use client';

import { createContext, useContext, type ReactNode } from 'react';

export interface NavigationIntent {
  href: string;
  replace?: boolean;
  scroll?: boolean;
}

export interface NavigationIntentEvent {
  preventDefault: () => void;
}

export type NavigationIntentHandler = (intent: NavigationIntent, event: NavigationIntentEvent) => void;

const NavigationIntentContext = createContext<NavigationIntentHandler | null>(null);

interface NavigationIntentProviderProps {
  children: ReactNode;
  onNavigationIntent: NavigationIntentHandler;
}

export function NavigationIntentProvider({ children, onNavigationIntent }: NavigationIntentProviderProps) {
  return <NavigationIntentContext.Provider value={onNavigationIntent}>{children}</NavigationIntentContext.Provider>;
}

export function useNavigationIntentHandler() {
  return useContext(NavigationIntentContext);
}
