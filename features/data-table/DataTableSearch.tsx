'use client';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { useDebouncedValue } from '@mantine/hooks';
import { SearchInput } from '@/components/core/Input/SearchInput';
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
  const lastSearchRef = useRef(query.search ?? '');
  const queryRef = useRef(query);
  queryRef.current = query;
  const onQueryChangeRef = useRef(onQueryChange);
  onQueryChangeRef.current = onQueryChange;

  useEffect(() => {
    const externalSearch = query.search ?? '';
    if (externalSearch !== lastSearchRef.current) {
      lastSearchRef.current = externalSearch;
      setSearch(externalSearch);
    }
  }, [query.search]);
  const effectivePlaceholder = placeholder ?? tCommonPlaceholders('search');

  useEffect(() => {
    // Only update if the debounced value differs from the last search we sent
    if (debouncedSearch !== lastSearchRef.current) {
      lastSearchRef.current = debouncedSearch;
      onQueryChangeRef.current({
        ...queryRef.current,
        search: debouncedSearch || undefined,
        page: 1,
      });
    }
  }, [debouncedSearch]);

  return (
    <DsLayoutStack flexible gap="none">
      <SearchInput
        aria-label={effectivePlaceholder}
        placeholder={effectivePlaceholder}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
      />
    </DsLayoutStack>
  );
}
