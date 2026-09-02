'use client';

import { useTranslations } from 'next-intl';
import { Avatar, Group, Text } from '@mantine/core';
import { LabelBadge, StatusBadge } from '@/components/core/Badge';
import { TextButton } from '@/components/core/TextButton';
import {
  ServerDataTableSelectableSection,
  type ServerDataTableSelectableSectionProps,
} from '@/features/data-table/ServerDataTable';
import { normalizeEnumToken } from '@/lib/i18n/admin-labels';
import { DateTime } from '@/features/date-time/DateTime';
import type { ColumnDef } from '@/lib/types/common/data-table';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';
import { ArtistRowMenu } from './ArtistRowMenu';

interface ArtistRow {
  id: string;
  name: string;
  slug: string | null;
  imageUrl: string | null;
  status: string;
  releaseCount: number;
  createdAt: Date | null;
}

function getColumns(labels: {
  artist: string;
  status: string;
  releases: string;
  created: string;
  draft: string;
  published: string;
}): ColumnDef<ArtistRow>[] {
  return [
    {
      key: 'artist',
      header: labels.artist,
      cell: (artist) => (
        <Group gap="sm">
          <Avatar src={buildManagedImageUrl(artist.imageUrl, MANAGED_IMAGE_PRESET.AVATAR_SM)} size="sm" radius="xl">
            {artist.name.charAt(0).toUpperCase()}
          </Avatar>
          <div>
            <TextButton href={`/artists/${artist.id}?edit=true`} size="sm" weight="medium" appearance="default">
              {artist.name}
            </TextButton>
            {artist.slug && (
              <Text size="xs" c="dimmed">
                /{artist.slug}
              </Text>
            )}
          </div>
        </Group>
      ),
    },
    {
      key: 'status',
      header: labels.status,
      cell: (artist) => (
        <StatusBadge tone={normalizeEnumToken(artist.status) === 'published' ? 'positive' : 'neutral'} size="sm">
          {normalizeEnumToken(artist.status) === 'published'
            ? labels.published
            : normalizeEnumToken(artist.status) === 'draft'
              ? labels.draft
              : artist.status}
        </StatusBadge>
      ),
    },
    {
      key: 'releases',
      header: labels.releases,
      cell: (artist) => <LabelBadge size="sm">{artist.releaseCount}</LabelBadge>,
    },
    {
      key: 'created',
      header: labels.created,
      cell: (artist) => (
        <Text size="sm" c="dimmed">
          <DateTime value={artist.createdAt} />
        </Text>
      ),
    },
    {
      key: 'actions',
      kind: 'action',
      header: '',
      width: 50,
      cell: (row) => <ArtistRowMenu artist={row} />,
    },
  ];
}

interface ArtistsTableContentProps {
  result: ServerDataTableSelectableSectionProps<ArtistRow>['result'];
  searchPlaceholder: string;
  filterFields: ServerDataTableSelectableSectionProps<ArtistRow>['filterFields'];
  sortFields: ServerDataTableSelectableSectionProps<ArtistRow>['sortFields'];
}

export function ArtistsTableContent({ result, searchPlaceholder, filterFields, sortFields }: ArtistsTableContentProps) {
  const tCommon = useTranslations('common');
  const tAdmin = useTranslations('adminList');
  const columns = getColumns({
    artist: tCommon('entities.artist'),
    status: tCommon('labels.status'),
    releases: tCommon('entities.releases'),
    created: tCommon('labels.created'),
    draft: tCommon('statuses.draft'),
    published: tCommon('statuses.published'),
  });

  return (
    <ServerDataTableSelectableSection
      namespace="artists"
      result={result}
      columns={columns}
      getRowKey={(row) => row.id}
      emptyMessage={tAdmin('artists.empty')}
      searchPlaceholder={searchPlaceholder}
      filterFields={filterFields}
      sortFields={sortFields}
    />
  );
}
