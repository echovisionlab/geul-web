'use client';

import { useTranslations } from 'next-intl';
import { Text } from '@mantine/core';
import { LabelBadge } from '@/components/core/Badge';
import { TextButton } from '@/components/core/TextButton';
import {
  ServerDataTableSelectableSection,
  type ServerDataTableSelectableSectionProps,
} from '@/features/data-table/ServerDataTable';
import { ThemedAssetImage } from '@/features/media/ThemedAssetImage';
import { deleteClientAction } from '@/lib/actions/client';
import { DateTime } from '@/features/date-time/DateTime';
import type { ColumnDef } from '@/lib/types/common/data-table';
import { ClientRowMenu } from './ClientRowMenu';

interface ClientRow {
  id: string;
  name: string;
  website: string | null;
  logoUrl: string | null;
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  workCount: number;
  createdAt: Date | null;
}

function getColumns(labels: {
  logo: string;
  name: string;
  website: string;
  works: string;
  created: string;
}): ColumnDef<ClientRow>[] {
  return [
    {
      key: 'logo',
      header: labels.logo,
      width: 80,
      cell: (row) =>
        row.logoUrl || row.logoLightUrl || row.logoDarkUrl ? (
          <ThemedAssetImage
            fallbackUrl={row.logoUrl}
            lightUrl={row.logoLightUrl}
            darkUrl={row.logoDarkUrl}
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
      header: labels.name,
      cell: (row) => (
        <TextButton href={`/admin/clients/${row.id}`} size="sm" weight="medium" appearance="default">
          {row.name}
        </TextButton>
      ),
    },
    {
      key: 'website',
      header: labels.website,
      cell: (row) =>
        row.website ? (
          <TextButton href={row.website} size="sm" appearance="accent" target="_blank" rel="noopener noreferrer">
            {row.website.replace(/^https?:\/\//, '')}
          </TextButton>
        ) : (
          <Text size="sm" c="dimmed">
            -
          </Text>
        ),
    },
    {
      key: 'works',
      header: labels.works,
      cell: (row) => <LabelBadge size="sm">{row.workCount}</LabelBadge>,
    },
    {
      key: 'created',
      header: labels.created,
      cell: (row) => (
        <Text size="sm" c="dimmed">
          <DateTime value={row.createdAt} />
        </Text>
      ),
    },
    {
      key: 'actions',
      kind: 'action',
      header: '',
      width: 50,
      cell: (row) => <ClientRowMenu client={row} />,
    },
  ];
}

interface ClientsTableContentProps {
  result: ServerDataTableSelectableSectionProps<ClientRow>['result'];
  searchPlaceholder: string;
  filterFields: ServerDataTableSelectableSectionProps<ClientRow>['filterFields'];
  sortFields: ServerDataTableSelectableSectionProps<ClientRow>['sortFields'];
}

export function ClientsTableContent({ result, searchPlaceholder, filterFields, sortFields }: ClientsTableContentProps) {
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tPage = useTranslations('adminList.clients');
  const columns = getColumns({
    logo: tCommon('labels.logo'),
    name: tCommon('labels.name'),
    website: tCommon('labels.website'),
    works: tCommon('labels.works'),
    created: tCommon('labels.created'),
  });

  return (
    <ServerDataTableSelectableSection
      namespace="clients"
      result={result}
      columns={columns}
      getRowKey={(row) => row.id}
      emptyMessage={tPage('empty')}
      searchPlaceholder={searchPlaceholder}
      filterFields={filterFields}
      sortFields={sortFields}
      bulkDelete={{
        entityLabel: tCommonEntities('clients'),
        deleteAction: deleteClientAction,
        getRowLabel: (row) => row.name || row.website || row.id,
      }}
    />
  );
}
