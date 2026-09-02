'use client';

import type { PropsWithChildren } from 'react';
import { Group } from '@mantine/core';

export interface DataTableToolbarProps extends PropsWithChildren {
  justify?: 'space-between' | 'flex-start' | 'flex-end' | 'center';
}

export function DataTableToolbar({ children, justify = 'space-between' }: DataTableToolbarProps) {
  return (
    <Group data-datatable-toolbar justify={justify} wrap="wrap" gap="sm" style={{ width: '100%' }}>
      {children}
    </Group>
  );
}
