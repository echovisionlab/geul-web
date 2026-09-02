'use client';

import { useEffect, useRef, useState } from 'react';
import { IconSearch } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Box } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { TextInput } from '@/components/core/Input';
import { useDataTableContext } from './DataTableContext';

export interface DataTableSearchProps {
  placeholder?: string;
  debounceMs?: number;
}

export function DataTableSearch({ placeholder, debounceMs = 300 }: DataTableSearchProps) {
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const { query, onQueryChange } = useDataTableContext();
  const [search, setSearch] = useState(query.search ?? '');
  const [debouncedSearch] = useDebouncedValue(search, debounceMs);
  const lastSearchRef = useRef(query.search);
  const effectivePlaceholder = placeholder ?? tCommonPlaceholders('search');

  useEffect(() => {
    // Only update if the debounced value differs from the last search we sent
    if (debouncedSearch !== lastSearchRef.current) {
      lastSearchRef.current = debouncedSearch || undefined;
      onQueryChange({
        ...query,
        search: debouncedSearch || undefined,
        page: 1,
      });
    }
  }, [debouncedSearch]); // intentionally only depend on debouncedSearch

  return (
    <Box style={{ flex: 1, maxWidth: 400 }}>
      <TextInput
        placeholder={effectivePlaceholder}
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
      />
    </Box>
  );
}
