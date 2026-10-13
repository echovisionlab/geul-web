'use client';

import { primitiveTokens } from './design-tokens';
import { createContext, useContext, type ReactNode } from 'react';

/** Composed headers establish one density for every action kind in their action slot. */
const ActionRowSizeContext = createContext<'xs' | 'sm' | 'md' | undefined>(undefined);
export const useActionRowSize = () => useContext(ActionRowSizeContext);
export function ActionRowSizeProvider({ size, children }: { size: 'xs' | 'sm' | 'md'; children: ReactNode }) {
  return <ActionRowSizeContext.Provider value={size}>{children}</ActionRowSizeContext.Provider>;
}

export type ControlContrast = 'standard' | 'inverse';
const ControlContrastContext = createContext<ControlContrast>('standard');
export const useControlContrast = () => useContext(ControlContrastContext);
export function ControlContrastProvider({ contrast, children }: { contrast: ControlContrast; children: ReactNode }) {
  return <ControlContrastContext.Provider value={contrast}>{children}</ControlContrastContext.Provider>;
}

export type ToolbarDensity = 'comfortable' | 'compact';
const ToolbarDensityContext = createContext<ToolbarDensity>('comfortable');
export const useToolbarDensity = () => useContext(ToolbarDensityContext);
export function ToolbarDensityProvider({ density, children }: { density: ToolbarDensity; children: ReactNode }) {
  return <ToolbarDensityContext.Provider value={density}>{children}</ToolbarDensityContext.Provider>;
}

/** Header slots share a compact presentation without changing their menu contents. */
const HeaderDensityContext = createContext<ToolbarDensity>('comfortable');
export const useHeaderDensity = () => useContext(HeaderDensityContext);
export function HeaderDensityProvider({ density, children }: { density: ToolbarDensity; children: ReactNode }) {
  return <HeaderDensityContext.Provider value={density}>{children}</HeaderDensityContext.Provider>;
}

/** Composition owns action geometry. Standalone actions retain their named size. */
export function resolveActionSize<T extends string | undefined>(
  size: T,
  rowSize: 'xs' | 'sm' | 'md' | undefined,
  density: ToolbarDensity,
): T | 'xs' | 'sm' | 'md' | 'compact' {
  if (size !== undefined && !Object.hasOwn(primitiveTokens.controlHeight, size)) {
    throw new RangeError('Actions require a registered control size');
  }
  return density === 'compact' ? 'compact' : (rowSize ?? size);
}
