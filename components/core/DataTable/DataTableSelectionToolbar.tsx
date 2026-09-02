import type { ReactNode } from 'react';
import { Group, Text } from '@mantine/core';

export interface DataTableSelectionToolbarProps {
  search: ReactNode;
  selectedCountLabel?: string | null;
  filters?: ReactNode;
  sorts?: ReactNode;
  actions?: ReactNode;
}

export function DataTableSelectionToolbar({
  search,
  selectedCountLabel,
  filters,
  sorts,
  actions,
}: DataTableSelectionToolbarProps) {
  return (
    <Group justify="space-between" wrap="wrap" gap="sm" style={{ width: '100%' }}>
      <Group gap="sm" wrap="wrap" style={{ flex: 1, minWidth: 0 }}>
        {search}
        {selectedCountLabel ? (
          <Text size="sm" c="dimmed">
            {selectedCountLabel}
          </Text>
        ) : null}
      </Group>
      <Group gap={4} wrap="wrap" justify="flex-end" style={{ marginLeft: 'auto' }}>
        {filters}
        {sorts}
        {actions}
      </Group>
    </Group>
  );
}
