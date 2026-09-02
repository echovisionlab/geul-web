import { Avatar, Stack, Text } from '@mantine/core';
import { StatusBadge } from '@/components/core/Badge';
import { TextButton } from '@/components/core/TextButton';

export interface MyArtistsTableRowViewModel {
  id: string;
  name: string;
  slugLabel: string | null;
  imageUrl: string | null;
  avatarFallback: string;
  href: string;
  statusLabel: string;
  createdLabel: string;
}

export type MyArtistsTableCell = 'avatar' | 'name' | 'status' | 'created';

export interface MyArtistsTableCellViewProps {
  cell: MyArtistsTableCell;
  row: MyArtistsTableRowViewModel;
}

/** Renders one domain-shaped artist cell from already formatted display values. */
export function MyArtistsTableCellView({ cell, row }: MyArtistsTableCellViewProps) {
  switch (cell) {
    case 'avatar':
      return (
        <Avatar src={row.imageUrl} alt={row.name} size="sm" radius="xl">
          {row.avatarFallback}
        </Avatar>
      );
    case 'name':
      return (
        <Stack gap={2} style={{ minWidth: 0 }}>
          <TextButton
            href={row.href}
            size="sm"
            weight="medium"
            appearance="accent"
            style={{ overflowWrap: 'anywhere' }}
          >
            {row.name}
          </TextButton>
          {row.slugLabel ? (
            <Text size="xs" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
              {row.slugLabel}
            </Text>
          ) : null}
        </Stack>
      );
    case 'status':
      return (
        <StatusBadge tone="neutral" appearance="outline" size="sm">
          {row.statusLabel}
        </StatusBadge>
      );
    case 'created':
      return (
        <Text size="sm" c="dimmed">
          {row.createdLabel}
        </Text>
      );
  }
}
