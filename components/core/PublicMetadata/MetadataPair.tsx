'use client';

import { createContext, useContext, useId, type ReactNode } from 'react';
import type { ClosedVisualProps } from '../visual-contract';
import classes from './PublicMetadata.module.css';

export type MetadataTextSize = 'xs' | 'sm' | 'md';
export const MetadataSizeContext = createContext<MetadataTextSize>('sm');
export function useMetadataTextSize() {
  return useContext(MetadataSizeContext);
}
export interface MetadataPairProps extends ClosedVisualProps {
  label: ReactNode;
  children: ReactNode;
  size?: MetadataTextSize;
  layout?: 'inline' | 'stacked';
}

/** A label and its value share one type scale; tone distinguishes their roles. */
export function MetadataPair({ label, children, size = 'sm', layout = 'inline' }: MetadataPairProps) {
  const labelId = useId();
  return (
    <MetadataSizeContext.Provider value={size}>
      <div className={classes.pair} data-size={size} data-layout={layout}>
        <span id={labelId} role="term" className={classes.pairLabel}>
          {label}
        </span>
        <div role="definition" aria-labelledby={labelId} className={classes.pairValue}>
          {children}
        </div>
      </div>
    </MetadataSizeContext.Provider>
  );
}
