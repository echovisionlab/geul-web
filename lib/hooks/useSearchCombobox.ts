'use client';

import { useState } from 'react';
import { useInputCombobox } from '@/components/core/Input';
import { useDebouncedValue } from '@mantine/hooks';

export interface UseSearchComboboxOptions {
  minQueryLength?: number;
  debounceMs?: number;
}

export function useSearchCombobox(options?: UseSearchComboboxOptions) {
  const { minQueryLength = 2, debounceMs = 300 } = options ?? {};

  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, debounceMs);

  const combobox = useInputCombobox();

  const isEnabled = debouncedSearch.length >= minQueryLength;

  const reset = () => {
    setSearch('');
    combobox.closeDropdown();
  };

  return {
    search,
    setSearch,
    debouncedSearch,
    combobox,
    isEnabled,
    reset,
  };
}
