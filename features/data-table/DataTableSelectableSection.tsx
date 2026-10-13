'use client';
import { ConfirmationDialog } from '@/features/confirmation';
import { useBulkDeletion } from '@/features/confirmation/useBulkDeletion';

import { Text as DsText } from '@/components/core/Typography';
import { notifications } from '@/components/core/Notification';
import { useState } from 'react';
import { IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import {
  DataTableSelectionToolbar,
  TableRowMenu,
  type DataTableViewRowAction,
  type TableRowMenuItem,
  useCurrentPageRowSelection,
} from '@/components/core/DataTable';

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
  deleteAction: (id: string) => Promise<{
    success?: boolean;
    error?: string;
  }>;
  getRowLabel: (row: T) => string;
  successMessage?: string;
  onSuccess?: (successfulIds: string[]) => void | Promise<void>;
}
export interface DataTableSelectableSectionProps<T> {
  result: PaginatedQueryResult<T> | undefined;
  accessibleLabel?: string;
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
  accessibleLabel,
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
  const tTableAria = useTranslations('dataTable.aria');
  const selection = useCurrentPageRowSelection(result?.data, getRowKey, bulkDelete?.getRowLabel);
  const [bulkDeleteOpened, setBulkDeleteOpened] = useState(false);
  const { loading: bulkDeleteLoading, execute: executeBulkDelete } = useBulkDeletion();
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
          tone: 'danger',
          disabled: selection.selectedOnPageCount === 0 || bulkDeleteLoading,
        },
      ]
    : [];
  const handleBulkDelete = async () => {
    if (!bulkDelete) {
      return;
    }
    await executeBulkDelete(
      selection.selectedOnPageRowKeys,
      bulkDelete.deleteAction,
      tCommon('errors.generic'),
      async ({ successfulIds, errors }) => {
        if (errors.length > 0) {
          notifications.show({ message: errors[0], tone: 'danger' });
        }
        if (successfulIds.length > 0) {
          await bulkDelete.onSuccess?.(successfulIds);
          notifications.show({
            message: bulkDelete.successMessage ?? tCommon('actions.delete'),
            tone: 'positive',
          });
          selection.clearSelection();
          setBulkDeleteOpened(false);
        }
      },
    );
  };

  return (
    <>
      <DataTable
        columns={columns}
        accessibleLabel={accessibleLabel ?? bulkDelete?.entityLabel}
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
              bulkDelete ? (
                <TableRowMenu
                  aria-label={tTableAria('rowActions', { label: bulkDelete.entityLabel })}
                  items={bulkActionItems}
                />
              ) : null
            }
          />
        </DataTable.Toolbar>
        <DataTable.Content />
        <DataTable.Pagination />
      </DataTable>
      {bulkDelete ? (
        <ConfirmationDialog
          intent="delete"
          opened={bulkDeleteOpened}
          onClose={() => setBulkDeleteOpened(false)}
          onConfirm={handleBulkDelete}
          title={tCommon('actions.delete')}
          message={
            <DsText>
              {singleSelectedRowLabel
                ? tCommon('messages.deleteNamedItemConfirm', { name: singleSelectedRowLabel })
                : tCommon('messages.confirmDeleteSelectedCount', {
                    count: selection.selectedOnPageCount,
                  })}
            </DsText>
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
