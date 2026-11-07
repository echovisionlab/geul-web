'use client';

import { StatusBadge, type StatusBadgeTone } from '@/components/core/Badge';
import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { TextButton } from '@/components/core/TextButton';
import { Heading as DsHeading, Text as DsText } from '@/components/core/Typography';

import { DataTable, type SortFieldConfig } from '@/features/data-table';
import { ThemedAssetImage } from '@/features/media/ThemedAssetImage';
import type { ColumnDef } from '@/lib/types/common/data-table';
import type { PaginatedQuery } from '@/lib/types/common/query';
import type { PaginatedQueryResult } from '@/lib/types/repository/result';

export interface MyLabelsTableRow {
  id: string;
  name: string;
  slugLabel: string | null;
  imageLightUrl: string | null;
  imageDarkUrl: string | null;
  href: string;
  statusLabel: string;
  statusTone: StatusBadgeTone;
  createdLabel: string;
}

export type MyLabelsDataTableResult = PaginatedQueryResult<MyLabelsTableRow>;

export interface MyLabelsDataTableLabels {
  title: string;
  logo: string;
  name: string;
  status: string;
  created: string;
  empty: string;
  searchPlaceholder: string;
}

export interface MyLabelsDataTableProps {
  /** Undefined while a page or search other than the server-rendered one is loading. */
  result: MyLabelsDataTableResult | undefined;
  labels: MyLabelsDataTableLabels;
  query: PaginatedQuery;
  loading?: boolean;
  onQueryChange: (query: PaginatedQuery) => void;
}

function getColumns(labels: MyLabelsDataTableLabels): ColumnDef<MyLabelsTableRow>[] {
  return [
    {
      key: 'logo',
      header: '',
      accessibleLabel: labels.logo,
      width: 80,
      cell: (row) =>
        row.imageLightUrl || row.imageDarkUrl ? (
          <ThemedAssetImage
            lightUrl={row.imageLightUrl}
            darkUrl={row.imageDarkUrl}
            alt={row.name}
            width={64}
            height={32}
            style={{ height: 32, maxWidth: 64, objectFit: 'contain' }}
          />
        ) : null,
    },
    {
      key: 'name',
      header: labels.name,
      cell: (row) => (
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
      ),
    },
    {
      key: 'status',
      header: labels.status,
      width: 120,
      cell: (row) => (
        <StatusBadge tone={row.statusTone} appearance="outline" size="sm">
          {row.statusLabel}
        </StatusBadge>
      ),
    },
    {
      key: 'createdAt',
      header: labels.created,
      width: 110,
      cell: (row) => (
        <DsText size="sm" tone="secondary">
          {row.createdLabel}
        </DsText>
      ),
    },
  ];
}

/** Connects the generic DataTable controller to the My Labels rows. */
export function MyLabelsDataTable({ result, labels, query, loading = false, onQueryChange }: MyLabelsDataTableProps) {
  const sortFields: SortFieldConfig[] = [
    { field: 'name', label: labels.name },
    { field: 'created_at', label: labels.created },
  ];

  return (
    <DsLayoutStack>
      <DsHeading level={1} scale={2}>
        {labels.title}
      </DsHeading>

      <DataTable
        accessibleLabel={labels.title}
        columns={getColumns(labels)}
        result={result}
        loading={loading}
        query={query}
        getRowKey={(row) => row.id}
        onQueryChange={onQueryChange}
        emptyMessage={labels.empty}
      >
        <DataTable.Toolbar>
          <DataTable.Search placeholder={labels.searchPlaceholder} />
          <DataTable.MultiSort fields={sortFields} />
        </DataTable.Toolbar>
        <DataTable.Content />
        <DataTable.Pagination />
      </DataTable>
    </DsLayoutStack>
  );
}
