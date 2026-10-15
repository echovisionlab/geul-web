'use client';

import type { ReactNode } from 'react';
import type { ClosedVisualProps } from '../visual-contract';
import { LayoutInline } from '../Layout';

export interface DialogActionsProps extends ClosedVisualProps {
  children: ReactNode;
  /** Separate destructive or auxiliary command from the concluding actions. */
  leadingActions?: ReactNode;
  id?: string;
  dir?: 'ltr' | 'rtl';
  justify?: never;
  gap?: never;
  grow?: never;
  wrap?: never;
}

/** Dialog commands keep content widths and end alignment in every viewport. */
export function DialogActions({ children, leadingActions, id, dir }: DialogActionsProps) {
  return (
    <LayoutInline id={id} dir={dir} fill="inline" gap="action-group" justify={leadingActions ? 'between' : 'end'}>
      {leadingActions}
      {leadingActions ? (
        <LayoutInline gap="action-group" justify="end" flexible>
          {children}
        </LayoutInline>
      ) : (
        children
      )}
    </LayoutInline>
  );
}
