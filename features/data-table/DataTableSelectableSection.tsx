'use client';

import { useState } from 'react';
import { IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  DataTableSelectionToolbar,
  TableRowMenu,
  type DataTableViewRowAction,
  type TableRowMenuItem,
  useCurrentPageRowSelection,
} from '@/components/core/DataTable';
import { ConfirmModal } from '@/components/core/Modal';
import { useLocale } from '@/lib/providers/LocaleProvider';
import type { ColumnDef } from '@/lib/types/common/data-table';
import type { PaginatedQuery } from '@/lib/types/common/query';
import type { PaginatedQueryResult } from '@/lib/types/repository/result';
import { DataTable } from './DataTable';
import type { FilterFieldConfig } from './DataTableMultiFilter';
import type { SortFieldConfig } from './DataTableMultiSort';
import { formatSelectedCountLabel } from './selection-label';

interface BulkDeleteConfig<T> {
  entityLabel: string;
  deleteAction: (id: string) => Promise<{ success?: boolean; error?: string }>;
  getRowLabel: (row: T) => string;
  successMessage?: string;
  successColor?: string;
  onSuccess?: (successfulIds: string[]) => void | Promise<void>;
}

export interface DataTableSelectableSectionProps<T> {
  result: PaginatedQueryResult<T> | undefined;
  loading?: boolean;
  query: PaginatedQuery;
  columns: ColumnDef<T>[];
  getRowKey: (row: T) => string;
  onQueryChange: (query: PaginatedQuery) => void;
  rowAction?: DataTableViewRowAction<T>;
  emptyMessage: string;
  searchPlaceholder: string;
  filterFields: FilterFieldConfig[];
  sortFields: SortFieldConfig[];
  bulkDelete?: BulkDeleteConfig<T>;
}

export function DataTableSelectableSection<T>({
  result,
  loading = false,
  query,
  columns,
  getRowKey,
  onQueryChange,
  rowAction,
  emptyMessage,
  searchPlaceholder,
  filterFields,
  sortFields,
  bulkDelete,
}: DataTableSelectableSectionProps<T>) {
  const locale = useLocale();
  const tCommon = useTranslations('common');
  const selection = useCurrentPageRowSelection(result?.data, getRowKey, bulkDelete?.getRowLabel);
  const [bulkDeleteOpened, setBulkDeleteOpened] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const singleSelectedRowLabel =
    bulkDelete && selection.selectedOnPageCount === 1
      ? (() => {
          const selectedRow = result?.data?.find((row) => getRowKey(row) === selection.selectedOnPageRowKeys[0]);
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
      const targetIds = selection.selectedOnPageRowKeys;
      const results = await Promise.all(targetIds.map((id) => bulkDelete.deleteAction(id)));
      const successfulIds = targetIds.filter((_, index) => !results[index]?.error);
      const errors = results.filter((result) => result.error);

      if (errors.length > 0) {
        notifications.show({
          message: errors[0]?.error ?? tCommon('errors.generic'),
          color: 'red',
        });
      }

      if (successfulIds.length > 0) {
        await bulkDelete.onSuccess?.(successfulIds);
        notifications.show({
          message: bulkDelete.successMessage ?? tCommon('actions.delete'),
          color: bulkDelete.successColor ?? 'red',
        });
        selection.clearSelection();
        setBulkDeleteOpened(false);
      }
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  return (
    <>
      <DataTable
        columns={columns}
        result={result}
        loading={loading}
        query={query}
        getRowKey={getRowKey}
        onQueryChange={onQueryChange}
        rowAction={rowAction}
        emptyMessage={emptyMessage}
        selection={bulkDelete ? selection : undefined}
      >
        <DataTable.Toolbar>
          <DataTableSelectionToolbar
            search={<DataTable.Search placeholder={searchPlaceholder} />}
            selectedCountLabel={
              bulkDelete && selection.selectedOnPageCount > 0
                ? formatSelectedCountLabel(locale, selection.selectedOnPageCount)
                : null
            }
            filters={<DataTable.MultiFilter fields={filterFields} />}
            sorts={<DataTable.MultiSort fields={sortFields} />}
            actions={
              bulkDelete ? <TableRowMenu aria-label={tCommon('labels.actions')} items={bulkActionItems} /> : null
            }
          />
        </DataTable.Toolbar>
        <DataTable.Content />
        <DataTable.Pagination />
      </DataTable>
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
