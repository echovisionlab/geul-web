import { useCallback, useMemo, useState } from 'react';
import { useCombobox } from '@mantine/core';

export interface MultiSelectItem {
  id: string;
  name: string;
}

export interface UseMultiSelectOptions<T extends MultiSelectItem> {
  selectedItems: T[];
  options: T[];
  onSelect: (item: T) => void;
  onDeselect: (item: T) => void;
  onCreate?: (name: string) => void;
  combineWithSelected?: boolean;
}

/**
 * Manages multi-select combobox state and filtering logic
 */
export function useMultiSelect<T extends MultiSelectItem>({
  selectedItems,
  options,
  onSelect,
  onDeselect,
  onCreate,
  combineWithSelected = false,
}: UseMultiSelectOptions<T>) {
  const [search, setSearch] = useState('');

  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
    onDropdownOpen: () => combobox.updateSelectedOptionIndex('active'),
  });

  const selectedIds = useMemo(() => new Set(selectedItems.map((item) => item.id)), [selectedItems]);

  // Combine options with selected items if needed
  const allOptions = useMemo(() => {
    if (!combineWithSelected) {
      return options;
    }
    const optionIds = new Set(options.map((o) => o.id));
    const merged = [...options];
    for (const item of selectedItems) {
      if (!optionIds.has(item.id)) {
        merged.push(item);
      }
    }
    return merged;
  }, [options, selectedItems, combineWithSelected]);

  // Filter by search
  const filteredOptions = useMemo(() => {
    const searchLower = search.trim().toLowerCase();
    if (!searchLower) {
      return allOptions;
    }
    return allOptions.filter((item) => item.name.toLowerCase().includes(searchLower));
  }, [allOptions, search]);

  // Check for exact match (for create option)
  const exactMatch = useMemo(() => {
    const searchLower = search.trim().toLowerCase();
    return allOptions.some((item) => item.name.toLowerCase() === searchLower);
  }, [allOptions, search]);

  const handleValueSelect = useCallback(
    (val: string) => {
      setSearch('');

      if (val === '$create' && onCreate) {
        onCreate(search.trim());
        return;
      }

      const item = allOptions.find((o) => o.id === val);
      if (!item) {
        return;
      }

      if (selectedIds.has(val)) {
        onDeselect(item);
      } else {
        onSelect(item);
      }
    },
    [allOptions, selectedIds, onSelect, onDeselect, onCreate, search],
  );

  const handleValueRemove = useCallback(
    (id: string) => {
      const item = selectedItems.find((i) => i.id === id);
      if (item) {
        onDeselect(item);
      }
    },
    [selectedItems, onDeselect],
  );

  const handleBackspace = useCallback(() => {
    if (search.length === 0 && selectedItems.length > 0) {
      const lastItem = selectedItems[selectedItems.length - 1];
      onDeselect(lastItem);
    }
  }, [search, selectedItems, onDeselect]);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const canCreate = useMemo(
    () => !!onCreate && !exactMatch && search.trim().length > 0,
    [onCreate, exactMatch, search],
  );

  return {
    search,
    setSearch,
    combobox,
    filteredOptions,
    selectedIds,
    isSelected,
    canCreate,
    handleValueSelect,
    handleValueRemove,
    handleBackspace,
  };
}
