'use client';

import { createContext, useContext, type ReactNode } from 'react';

export type AuthoringExtensionKind = 'sharing' | 'translations' | 'relations' | 'uploads' | 'generation';
const AuthoringExtensionsContext = createContext<Partial<Record<AuthoringExtensionKind, boolean>>>({});

/** Availability for embedded editors. Existing permission checks still govern each extension. */
export function AuthoringExtensionsProvider({
  available,
  children,
}: {
  available: Partial<Record<AuthoringExtensionKind, boolean>>;
  children: ReactNode;
}) {
  return <AuthoringExtensionsContext.Provider value={available}>{children}</AuthoringExtensionsContext.Provider>;
}

export function AuthoringExtension({ kind, children }: { kind: AuthoringExtensionKind; children: ReactNode }) {
  return useAuthoringExtensionAvailable(kind) ? children : null;
}

export function useAuthoringExtensionAvailable(kind: AuthoringExtensionKind) {
  return useContext(AuthoringExtensionsContext)[kind] !== false;
}
