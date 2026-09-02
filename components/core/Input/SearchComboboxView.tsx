'use client';

import type { ReactNode } from 'react';
import { Combobox, InputBase, Loader, useCombobox } from '@mantine/core';

export interface SearchComboboxViewProps<T> {
  combobox: ReturnType<typeof useCombobox>;
  search: string;
  onSearchChange: (value: string) => void;
  placeholder: string;
  label?: ReactNode;
  leftSection?: ReactNode;
  items: T[];
  isLoading?: boolean;
  minQueryLength?: number;
  debouncedSearch: string;
  onSelect: (id: string) => void;
  renderItem: (item: T) => ReactNode;
  getItemId: (item: T) => string;
  inputId?: string;
  emptyMessage?: string;
  minimumQueryMessage: string;
  noResultsMessage: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  flex?: number;
}

export function SearchComboboxView<T>({
  combobox,
  search,
  onSearchChange,
  placeholder,
  label,
  leftSection,
  items,
  isLoading = false,
  minQueryLength = 2,
  debouncedSearch,
  onSelect,
  renderItem,
  getItemId,
  inputId,
  emptyMessage,
  minimumQueryMessage,
  noResultsMessage,
  size = 'xs',
  flex,
}: SearchComboboxViewProps<T>) {
  return (
    <Combobox store={combobox} onOptionSubmit={onSelect}>
      <Combobox.Target>
        <InputBase
          data-search-combobox-target
          id={inputId}
          label={label}
          size={size}
          flex={flex}
          placeholder={placeholder}
          value={search}
          onChange={(e) => {
            onSearchChange(e.currentTarget.value);
            combobox.openDropdown();
          }}
          onFocus={() => {
            if (search.length >= minQueryLength) {
              combobox.openDropdown();
            }
          }}
          rightSection={isLoading ? <Loader size={size === 'xs' ? 12 : 16} /> : null}
          leftSection={leftSection}
        />
      </Combobox.Target>
      <Combobox.Dropdown data-search-combobox-dropdown>
        <Combobox.Options>
          {items.length === 0 ? (
            <Combobox.Empty>
              {debouncedSearch.length < minQueryLength ? minimumQueryMessage : emptyMessage || noResultsMessage}
            </Combobox.Empty>
          ) : (
            items.map((item) => (
              <Combobox.Option key={getItemId(item)} value={getItemId(item)}>
                {renderItem(item)}
              </Combobox.Option>
            ))
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
