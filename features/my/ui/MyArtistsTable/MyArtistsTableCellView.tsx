import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';

import { Avatar } from '@/components/core/Display';
import { StatusBadge, type StatusBadgeTone } from '@/components/core/Badge';
import { TextButton } from '@/components/core/TextButton';

export interface MyArtistsTableRowViewModel {
  id: string;
  name: string;
  slugLabel: string | null;
  imageUrl: string | null;
  href: string;
  statusLabel: string;
  statusTone: StatusBadgeTone;
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
      return <Avatar src={row.imageUrl} alt={row.name} size="sm" shape="circle" name={row.name} />;
    case 'name':
      return (
        <DsLayoutStack gap="xxs">
          <TextButton href={row.href} size="sm" weight="medium" appearance="accent">
            {row.name}
          </TextButton>
          {row.slugLabel ? (
            <DsText size="xs" tone="secondary" wrap="anywhere">
              {row.slugLabel}
            </DsText>
          ) : null}
        </DsLayoutStack>
      );
    case 'status':
      return (
        <StatusBadge tone={row.statusTone} appearance="outline" size="sm">
          {row.statusLabel}
        </StatusBadge>
      );
    case 'created':
      return (
        <DsText size="sm" tone="secondary">
          {row.createdLabel}
        </DsText>
      );
  }
}
