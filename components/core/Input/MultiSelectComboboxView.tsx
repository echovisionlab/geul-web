'use client';
import type { ReactNode } from 'react';
import { MultiSelect } from './MultiSelect';
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
  combineWithSelected?: boolean;
}
export function MultiSelectComboboxView<T extends MultiSelectItem>(props: MultiSelectComboboxViewProps<T>) {
  const state = useMultiSelect({ ...props, onCreate: props.canCreateNew ? props.onCreate : undefined });
  // MultiSelect filters the menu; retain the complete data so selected pills keep their labels.
  const options = state.allOptions.map((item) => ({ value: item.id, label: item.name }));
  if (state.canCreate) {
    options.push({ value: '$create', label: state.search });
  }
  return (
    <MultiSelect
      label={props.label}
      id={props.idPrefix ? `${props.idPrefix}-input` : undefined}
      placeholder={props.placeholder}
      data={options}
      value={props.selectedItems.map((item) => item.id)}
      searchable
      disabled={!props.canEdit}
      searchValue={state.search}
      onSearchChange={state.setSearch}
      aria-busy={props.isLoading || props.isCreating || undefined}
      nothingFoundMessage={state.search.trim() ? props.notFoundMessage : props.emptyMessage}
      renderOption={({ option }) => (option.value === '$create' ? props.createOptionLabel(state.search) : option.label)}
      onChange={(values) => {
        const selected = new Set(props.selectedItems.map((item) => item.id));
        for (const value of values) {
          if (!selected.has(value)) {
            state.handleValueSelect(value);
          }
        }
        for (const value of selected) {
          if (!values.includes(value)) {
            state.handleValueRemove(value);
          }
        }
      }}
    />
  );
}
export type { MultiSelectItem };
