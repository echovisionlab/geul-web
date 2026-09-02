'use client';

import { Group, Pagination } from '@mantine/core';
import { useDataTableContext } from './DataTableContext';

export function DataTablePagination() {
  const { result, query, onQueryChange } = useDataTableContext();

  if (!result || result.totalPages < 1) {
    return null;
  }

  const handlePageChange = (page: number) => {
    onQueryChange({ ...query, page });
  };

  return (
    <Group justify="center" mt="md">
      <Pagination total={result.totalPages} value={result.page} onChange={handlePageChange} />
    </Group>
  );
}
