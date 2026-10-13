'use client';

import { ToolbarLayout } from '../Section/ToolbarLayout';
import type { PropsWithChildren } from 'react';

export interface DataTableToolbarProps extends PropsWithChildren {
  justify?: 'between' | 'start' | 'end' | 'center';
}

export function DataTableToolbar({ children, justify = 'between' }: DataTableToolbarProps) {
  return (
    <ToolbarLayout data-datatable-toolbar justify={justify}>
      {children}
    </ToolbarLayout>
  );
}
