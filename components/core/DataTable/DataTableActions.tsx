'use client';

import { LayoutInline as DsLayoutInline } from '../Layout';
import type { PropsWithChildren } from 'react';

export function DataTableActions({ children }: PropsWithChildren) {
  return (
    <DsLayoutInline gap="action-group" wrap="wrap">
      {children}
    </DsLayoutInline>
  );
}
