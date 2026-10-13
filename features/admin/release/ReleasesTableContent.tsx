'use client';

import { LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { useTranslations } from 'next-intl';

import { Avatar } from '@/components/core/Display';
import { LabelBadge, StatusBadge, type StatusTone } from '@/components/core/Badge';
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

const STATUS_TONES: Record<string, StatusTone> = {
  draft: 'neutral',
  published: 'positive',
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
        <DsLayoutInline gap="sm">
          <Avatar
            src={buildManagedImageUrl(row.artworkUrl, MANAGED_IMAGE_PRESET.COVER_THUMB)}
            size="md"
            shape="square"
            name={row.title}
          />
          <div>
            <TextButton href={`/releases/${row.id}?edit=true`} size="sm" weight="medium" appearance="default">
              {row.title || labels.untitled}
            </TextButton>
            {row.slug && (
              <DsText size="xs" tone="secondary">
                /{row.slug}
              </DsText>
            )}
          </div>
        </DsLayoutInline>
      ),
    },
    {
      key: 'type',
      header: labels.type,
      cell: (row) => (
        <LabelBadge appearance="soft" size="sm" tone="neutral">
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
        <DsText size="sm" tone="secondary">
          <DateTime value={row.releaseDate} timeZone="UTC" />
        </DsText>
      ),
    },
    {
      key: 'status',
      header: labels.status,
      cell: (row) => (
        <StatusBadge appearance="dot" size="sm" tone={STATUS_TONES[normalizeEnumToken(row.status)] ?? 'neutral'}>
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
  deleteAction?: typeof deleteReleaseAction;
  result: ServerDataTableSelectableSectionProps<ReleaseRow>['result'];
  searchPlaceholder: string;
  filterFields: ServerDataTableSelectableSectionProps<ReleaseRow>['filterFields'];
  sortFields: ServerDataTableSelectableSectionProps<ReleaseRow>['sortFields'];
}

export function ReleasesTableContent({
  result,
  deleteAction = deleteReleaseAction,
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
        deleteAction,
        getRowLabel: (row) => row.title || row.slug || row.id,
      }}
    />
  );
}
