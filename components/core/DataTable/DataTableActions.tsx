'use client';

import type { PropsWithChildren } from 'react';
import { Group } from '@mantine/core';

export function DataTableActions({ children }: PropsWithChildren) {
  return (
    <Group gap="sm" wrap="nowrap">
      {children}
    </Group>
  );
}
