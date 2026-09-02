'use client';

import { useTranslations } from 'next-intl';
import { Text } from '@mantine/core';
import { LabelBadge, StatusBadge } from '@/components/core/Badge';
import { TextButton } from '@/components/core/TextButton';
import {
  ServerDataTableSelectableSection,
  type ServerDataTableSelectableSectionProps,
} from '@/features/data-table/ServerDataTable';
import { ThemedAssetImage } from '@/features/media/ThemedAssetImage';
import { normalizeEnumToken } from '@/lib/i18n/admin-labels';
import type { ColumnDef } from '@/lib/types/common/data-table';
import { LabelRowMenu } from './LabelRowMenu';

interface LabelRow {
  id: string;
  name: string;
  slug: string | null;
  imageUrl: string | null;
  imageLightUrl: string | null;
  imageDarkUrl: string | null;
  status: string;
  artistCount: number;
  releaseCount: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}

function getColumns(labels: {
  logo: string;
  label: string;
  slug: string;
  status: string;
  releases: string;
  draft: string;
  published: string;
}): ColumnDef<LabelRow>[] {
  return [
    {
      key: 'logo',
      header: labels.logo,
      width: 80,
      cell: (row) =>
        row.imageUrl || row.imageLightUrl || row.imageDarkUrl ? (
          <ThemedAssetImage
            fallbackUrl={row.imageUrl}
            lightUrl={row.imageLightUrl}
            darkUrl={row.imageDarkUrl}
            alt={row.name}
            width={64}
            height={32}
            style={{
              height: 32,
              maxWidth: 64,
              objectFit: 'contain',
            }}
          />
        ) : null,
    },
    {
      key: 'name',
      header: labels.label,
      cell: (row) => (
        <TextButton href={`/labels/${row.id}?edit=true`} size="sm" weight="medium" appearance="default">
          {row.name}
        </TextButton>
      ),
    },
    {
      key: 'slug',
      header: labels.slug,
      cell: (row) => (
        <Text size="sm" c="dimmed">
          /{row.slug}
        </Text>
      ),
    },
    {
      key: 'status',
      header: labels.status,
      cell: (row) => (
        <StatusBadge tone={normalizeEnumToken(row.status) === 'published' ? 'positive' : 'neutral'} size="sm">
          {normalizeEnumToken(row.status) === 'published'
            ? labels.published
            : normalizeEnumToken(row.status) === 'draft'
              ? labels.draft
              : row.status}
        </StatusBadge>
      ),
    },
    {
      key: 'releaseCount',
      header: labels.releases,
      cell: (row) => <LabelBadge size="sm">{row.releaseCount}</LabelBadge>,
    },
    {
      key: 'actions',
      kind: 'action',
      header: '',
      width: 50,
      cell: (row) => <LabelRowMenu label={row} />,
    },
  ];
}

interface LabelsTableContentProps {
  result: ServerDataTableSelectableSectionProps<LabelRow>['result'];
  searchPlaceholder: string;
  filterFields: ServerDataTableSelectableSectionProps<LabelRow>['filterFields'];
  sortFields: ServerDataTableSelectableSectionProps<LabelRow>['sortFields'];
}

export function LabelsTableContent({ result, searchPlaceholder, filterFields, sortFields }: LabelsTableContentProps) {
  const tCommon = useTranslations('common');
  const tAdmin = useTranslations('adminList');
  const columns = getColumns({
    logo: tCommon('labels.logo'),
    label: tCommon('entities.label'),
    slug: tCommon('labels.slug'),
    status: tCommon('labels.status'),
    releases: tCommon('entities.releases'),
    draft: tCommon('statuses.draft'),
    published: tCommon('statuses.published'),
  });

  return (
    <ServerDataTableSelectableSection
      namespace="labels"
      result={result}
      columns={columns}
      getRowKey={(row) => row.id}
      emptyMessage={tAdmin('labels.empty')}
      searchPlaceholder={searchPlaceholder}
      filterFields={filterFields}
      sortFields={sortFields}
    />
  );
}
