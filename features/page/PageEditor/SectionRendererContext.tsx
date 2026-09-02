'use client';

import { createContext, useContext, type ComponentType, type ReactNode } from 'react';
import type { SectionMeta } from './types';

export interface SectionRendererProps {
  section: SectionMeta;
  isExpanded?: boolean;
}

export type SectionRenderer = ComponentType<SectionRendererProps>;

const SectionRendererContext = createContext<SectionRenderer | null>(null);

export function SectionRendererProvider({ renderer, children }: { renderer: SectionRenderer; children: ReactNode }) {
  return <SectionRendererContext.Provider value={renderer}>{children}</SectionRendererContext.Provider>;
}

export function useSectionRenderer() {
  const renderer = useContext(SectionRendererContext);
  if (!renderer) {
    throw new Error('Nested page sections require a SectionRendererProvider');
  }
  return renderer;
}
