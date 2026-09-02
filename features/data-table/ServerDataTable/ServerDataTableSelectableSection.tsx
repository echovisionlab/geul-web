'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  DataTableSelectionToolbar,
  TableRowMenu,
  type TableRowMenuItem,
  useCurrentPageRowSelection,
} from '@/components/core/DataTable';
import { ConfirmModal } from '@/components/core/Modal';
import { useLocale } from '@/lib/providers/LocaleProvider';
import type { ColumnDef } from '@/lib/types/common/data-table';
import type { PaginatedQueryResult } from '@/lib/types/repository/result';
import { ServerDataTable } from './ServerDataTable';
import type { FilterFieldConfig } from './ServerDataTableMultiFilter';
import type { SortFieldConfig } from './ServerDataTableMultiSort';
import { formatSelectedCountLabel } from '../selection-label';

interface BulkDeleteConfig<T> {
  entityLabel: string;
  deleteAction: (id: string) => Promise<{ success?: boolean; error?: string }>;
  getRowLabel: (row: T) => string;
}

export interface ServerDataTableSelectableSectionProps<T> {
  namespace: string;
  result: PaginatedQueryResult<T>;
  columns: ColumnDef<T>[];
  getRowKey: (row: T) => string;
  emptyMessage: string;
  searchPlaceholder: string;
  filterFields: FilterFieldConfig[];
  sortFields: SortFieldConfig[];
  allowFilterLogicToggle?: boolean;
  bulkDelete?: BulkDeleteConfig<T>;
}

export function ServerDataTableSelectableSection<T>({
  namespace,
  result,
  columns,
  getRowKey,
  emptyMessage,
  searchPlaceholder,
  filterFields,
  sortFields,
  allowFilterLogicToggle = true,
  bulkDelete,
}: ServerDataTableSelectableSectionProps<T>) {
  const router = useRouter();
  const locale = useLocale();
  const tCommon = useTranslations('common');
  const selection = useCurrentPageRowSelection(result.data, getRowKey, bulkDelete?.getRowLabel);
  const [bulkDeleteOpened, setBulkDeleteOpened] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const singleSelectedRowLabel =
    bulkDelete && selection.selectedOnPageCount === 1
      ? (() => {
          const selectedRow = result.data.find((row) => getRowKey(row) === selection.selectedOnPageRowKeys[0]);
          return selectedRow ? bulkDelete.getRowLabel(selectedRow) : null;
        })()
      : null;

  const bulkActionItems: TableRowMenuItem[] = bulkDelete
    ? [
        {
          label: tCommon('actions.clearAll'),
          onClick: selection.clearSelection,
          disabled: selection.selectedOnPageCount === 0 || bulkDeleteLoading,
        },
        {
          label: tCommon('actions.delete'),
          icon: <IconTrash size={16} />,
          onClick: () => setBulkDeleteOpened(true),
          color: 'red',
          disabled: selection.selectedOnPageCount === 0 || bulkDeleteLoading,
        },
      ]
    : [];

  const handleBulkDelete = async () => {
    if (!bulkDelete) {
      return;
    }

    setBulkDeleteLoading(true);
    try {
      const results = await Promise.all(selection.selectedOnPageRowKeys.map((id) => bulkDelete.deleteAction(id)));
      const errors = results.filter((result) => result.error);

      if (errors.length > 0) {
        notifications.show({
          message: errors[0]?.error ?? tCommon('errors.generic'),
          color: 'red',
        });
      }

      if (results.length > errors.length) {
        selection.clearSelection();
        setBulkDeleteOpened(false);
        router.refresh();
      }
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  return (
    <>
      <ServerDataTable.Toolbar>
        <DataTableSelectionToolbar
          search={<ServerDataTable.Search namespace={namespace} placeholder={searchPlaceholder} />}
          selectedCountLabel={
            bulkDelete && selection.selectedOnPageCount > 0
              ? formatSelectedCountLabel(locale, selection.selectedOnPageCount)
              : null
          }
          filters={
            <ServerDataTable.MultiFilter
              namespace={namespace}
              fields={filterFields}
              allowLogicToggle={allowFilterLogicToggle}
            />
          }
          sorts={<ServerDataTable.MultiSort namespace={namespace} fields={sortFields} />}
          actions={bulkDelete ? <TableRowMenu aria-label={tCommon('labels.actions')} items={bulkActionItems} /> : null}
        />
      </ServerDataTable.Toolbar>
      <ServerDataTable.Content
        columns={columns}
        result={result}
        getRowKey={getRowKey}
        emptyMessage={emptyMessage}
        selection={bulkDelete ? selection : undefined}
      />
      {bulkDelete ? (
        <ConfirmModal
          opened={bulkDeleteOpened}
          onClose={() => setBulkDeleteOpened(false)}
          onConfirm={handleBulkDelete}
          title={tCommon('actions.delete')}
          message={
            <Text>
              {singleSelectedRowLabel
                ? tCommon('messages.deleteNamedItemConfirm', { name: singleSelectedRowLabel })
                : tCommon('messages.confirmDeleteSelectedCount', {
                    count: selection.selectedOnPageCount,
                  })}
            </Text>
          }
          confirmLabel={tCommon('actions.delete')}
          cancelLabel={tCommon('actions.cancel')}
          closeLabel={tCommon('actions.close')}
          loading={bulkDeleteLoading}
        />
      ) : null}
    </>
  );
}
