'use client';

import type { ReactNode } from 'react';
import { CheckIcon, Combobox, Group, Loader, Pill, PillsInput, Stack, Text } from '@mantine/core';
import { useMultiSelect, type MultiSelectItem } from './useMultiSelect';

export interface MultiSelectComboboxViewProps<T extends MultiSelectItem> {
  label: string;
  idPrefix?: string;
  placeholder: string;
  emptyMessage: string;
  notFoundMessage: string;

  selectedItems: T[];
  options: T[];
  isLoading?: boolean;
  isCreating?: boolean;

  onSelect: (item: T) => void;
  onDeselect: (item: T) => void;
  onCreate?: (name: string) => void;
  createOptionLabel: (name: string) => ReactNode;

  canEdit: boolean;
  canCreateNew?: boolean;

  /**
   * When true, merges selectedItems with options to ensure selected items
   * are always visible in the dropdown (useful when options are search-filtered).
   */
  combineWithSelected?: boolean;
}

export function MultiSelectComboboxView<T extends MultiSelectItem>({
  label,
  idPrefix,
  placeholder,
  emptyMessage,
  notFoundMessage,
  selectedItems,
  options,
  isLoading = false,
  isCreating = false,
  onSelect,
  onDeselect,
  onCreate,
  createOptionLabel,
  canEdit,
  canCreateNew = false,
  combineWithSelected = false,
}: MultiSelectComboboxViewProps<T>) {
  const {
    search,
    setSearch,
    combobox,
    filteredOptions,
    isSelected,
    canCreate,
    handleValueSelect,
    handleValueRemove,
    handleBackspace,
  } = useMultiSelect({
    selectedItems,
    options,
    onSelect,
    onDeselect,
    onCreate: canCreateNew ? onCreate : undefined,
    combineWithSelected,
  });

  const pills = selectedItems.map((item) => (
    <Pill key={item.id} withRemoveButton={canEdit} onRemove={() => handleValueRemove(item.id)}>
      {item.name}
    </Pill>
  ));

  const optionElements = filteredOptions.map((item) => (
    <Combobox.Option value={item.id} key={item.id} active={isSelected(item.id)}>
      <Group gap="sm">
        {isSelected(item.id) ? <CheckIcon size={12} /> : null}
        <span>{item.name}</span>
      </Group>
    </Combobox.Option>
  ));

  return (
    <Stack gap={4}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Combobox store={combobox} onOptionSubmit={handleValueSelect} withinPortal={false} disabled={!canEdit}>
        <Combobox.DropdownTarget>
          <PillsInput
            onClick={() => canEdit && combobox.openDropdown()}
            rightSection={isLoading || isCreating ? <Loader size={16} /> : null}
            disabled={!canEdit}
          >
            <Pill.Group>
              {pills}

              {canEdit && (
                <Combobox.EventsTarget>
                  <PillsInput.Field
                    id={idPrefix ? `${idPrefix}-input` : undefined}
                    onFocus={() => combobox.openDropdown()}
                    onBlur={() => combobox.closeDropdown()}
                    value={search}
                    placeholder={selectedItems.length === 0 ? placeholder : ''}
                    onChange={(event) => {
                      combobox.updateSelectedOptionIndex();
                      setSearch(event.currentTarget.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Backspace' && search.length === 0) {
                        event.preventDefault();
                        handleBackspace();
                      }
                    }}
                  />
                </Combobox.EventsTarget>
              )}
            </Pill.Group>
          </PillsInput>
        </Combobox.DropdownTarget>

        <Combobox.Dropdown>
          <Combobox.Options>
            {optionElements}

            {canCreate && <Combobox.Option value="$create">{createOptionLabel(search)}</Combobox.Option>}

            {optionElements.length === 0 && search.trim().length === 0 && (
              <Combobox.Empty>{emptyMessage}</Combobox.Empty>
            )}

            {optionElements.length === 0 && search.trim().length > 0 && !canCreateNew && (
              <Combobox.Empty>{notFoundMessage}</Combobox.Empty>
            )}
          </Combobox.Options>
        </Combobox.Dropdown>
      </Combobox>
    </Stack>
  );
}

export type { MultiSelectItem };
