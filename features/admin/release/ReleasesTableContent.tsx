'use client';

import { useTranslations } from 'next-intl';
import { Avatar, Group, Text } from '@mantine/core';
import { badgeToneFromColor, statusToneFromColor, LabelBadge, StatusBadge } from '@/components/core/Badge';
import { DateTime } from '@/features/date-time/DateTime';
import { TextButton } from '@/components/core/TextButton';
import {
  ServerDataTableSelectableSection,
  type ServerDataTableSelectableSectionProps,
} from '@/features/data-table/ServerDataTable';
import { deleteReleaseAction } from '@/lib/actions/release';
import { normalizeEnumToken } from '@/lib/i18n/admin-labels';
import type { ColumnDef } from '@/lib/types/common/data-table';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';
import { ReleaseRowMenu } from './ReleaseRowMenu';

interface ReleaseRow {
  id: string;
  title: string;
  slug: string | null;
  type: string;
  status: string;
  releaseDate: Date | null;
  artworkUrl: string | null;
}

const TYPE_COLORS: Record<string, string> = {
  album: 'blue',
  ep: 'green',
  single: 'orange',
  compilation: 'grape',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'gray',
  published: 'green',
};

function getColumns(labels: {
  release: string;
  untitled: string;
  type: string;
  releaseDate: string;
  status: string;
  draft: string;
  published: string;
  releaseTypes: { album: string; ep: string; single: string; compilation: string };
}): ColumnDef<ReleaseRow>[] {
  return [
    {
      key: 'release',
      header: labels.release,
      cell: (row) => (
        <Group gap="sm">
          <Avatar src={buildManagedImageUrl(row.artworkUrl, MANAGED_IMAGE_PRESET.COVER_THUMB)} size="md" radius="sm">
            {(row.title || 'U').charAt(0)}
          </Avatar>
          <div>
            <TextButton href={`/releases/${row.id}?edit=true`} size="sm" weight="medium" appearance="default">
              {row.title || labels.untitled}
            </TextButton>
            {row.slug && (
              <Text size="xs" c="dimmed">
                /{row.slug}
              </Text>
            )}
          </div>
        </Group>
      ),
    },
    {
      key: 'type',
      header: labels.type,
      cell: (row) => (
        <LabelBadge appearance="soft" size="sm" tone={badgeToneFromColor(TYPE_COLORS[row.type] || 'gray')}>
          {(() => {
            const normalizedType = normalizeEnumToken(row.type);
            switch (normalizedType) {
              case 'album':
                return labels.releaseTypes.album;
              case 'ep':
                return labels.releaseTypes.ep;
              case 'single':
                return labels.releaseTypes.single;
              case 'compilation':
                return labels.releaseTypes.compilation;
              default:
                return row.type.toUpperCase();
            }
          })()}
        </LabelBadge>
      ),
    },
    {
      key: 'releaseDate',
      header: labels.releaseDate,
      cell: (row) => (
        <Text size="sm" c="dimmed">
          <DateTime value={row.releaseDate} timeZone="UTC" />
        </Text>
      ),
    },
    {
      key: 'status',
      header: labels.status,
      cell: (row) => (
        <StatusBadge
          appearance="dot"
          size="sm"
          tone={statusToneFromColor(STATUS_COLORS[normalizeEnumToken(row.status)] || 'gray')}
        >
          {normalizeEnumToken(row.status) === 'published'
            ? labels.published
            : normalizeEnumToken(row.status) === 'draft'
              ? labels.draft
              : row.status}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      kind: 'action',
      header: '',
      width: 50,
      cell: (row) => <ReleaseRowMenu release={row} />,
    },
  ];
}

interface ReleasesTableContentProps {
  result: ServerDataTableSelectableSectionProps<ReleaseRow>['result'];
  searchPlaceholder: string;
  filterFields: ServerDataTableSelectableSectionProps<ReleaseRow>['filterFields'];
  sortFields: ServerDataTableSelectableSectionProps<ReleaseRow>['sortFields'];
}

export function ReleasesTableContent({
  result,
  searchPlaceholder,
  filterFields,
  sortFields,
}: ReleasesTableContentProps) {
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tAdmin = useTranslations('adminList');
  const tReleaseTypes = useTranslations('releasePage.types');
  const columns = getColumns({
    release: tCommon('entities.release'),
    untitled: tCommon('states.untitled'),
    type: tCommon('labels.type'),
    releaseDate: tCommon('labels.releaseDate'),
    status: tCommon('labels.status'),
    draft: tCommon('statuses.draft'),
    published: tCommon('statuses.published'),
    releaseTypes: {
      album: tReleaseTypes('album'),
      ep: tReleaseTypes('ep'),
      single: tReleaseTypes('single'),
      compilation: tReleaseTypes('compilation'),
    },
  });

  return (
    <ServerDataTableSelectableSection
      namespace="releases"
      result={result}
      columns={columns}
      getRowKey={(row) => row.id}
      emptyMessage={tAdmin('releases.empty')}
      searchPlaceholder={searchPlaceholder}
      filterFields={filterFields}
      sortFields={sortFields}
      bulkDelete={{
        entityLabel: tCommonEntities('releases'),
        deleteAction: deleteReleaseAction,
        getRowLabel: (row) => row.title || row.slug || row.id,
      }}
    />
  );
}
