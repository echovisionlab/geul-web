'use client';
import { LayoutInline as DsLayoutInline, LayoutInset as DsLayoutInset } from '@/components/core/Layout';
import { useTranslations } from 'next-intl';

import { Pagination } from '@/components/core/Display';
import { useDataTableContext } from './DataTableContext';

export function DataTablePagination() {
  const tPagination = useTranslations('dataTable.pagination');
  const { result, query, onQueryChange } = useDataTableContext();

  if (!result || result.totalPages < 1) {
    return null;
  }

  const handlePageChange = (page: number) => {
    onQueryChange({ ...query, page });
  };

  return (
    <DsLayoutInset blockStart="md">
      <DsLayoutInline justify="center">
        <Pagination
          total={result.totalPages}
          value={result.page}
          onChange={handlePageChange}
          labels={{
            previousPage: tPagination('previousPage'),
            nextPage: tPagination('nextPage'),
            page: (page) => tPagination('page', { page }),
          }}
        />
      </DsLayoutInline>
    </DsLayoutInset>
  );
}
