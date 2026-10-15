'use client';
import { createContext } from 'react';
/** Private coordination for hints and an interactive overlay in the same trigger subtree. */
export const OverlayHintContext = createContext<{
  suppressed: boolean;
  registerOverlay?: (id: string, opened: boolean) => void;
} | null>(null);
