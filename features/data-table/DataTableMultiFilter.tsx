'use client';

import { useMemo, useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import {
  getOperatorsForType,
  isNoValueOperator,
  type FilterOperator,
  type FilterSpec,
} from '@/lib/types/common/filter';
import { useDataTableContext } from './DataTableContext';
import { MultiFilterEditorView } from './MultiFilterEditorView';
import { type ActiveFilter, type FilterEditState, type FilterFieldConfig } from './multi-filter-model';

export type { FilterFieldConfig } from './multi-filter-model';

export interface DataTableMultiFilterProps {
  fields: FilterFieldConfig[];
  placeholder?: string;
  allowLogicToggle?: boolean;
}

export function DataTableMultiFilter({ fields, placeholder, allowLogicToggle = true }: DataTableMultiFilterProps) {
  const { query, onQueryChange } = useDataTableContext();
  const [opened, setOpened] = useState(false);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [editState, setEditState] = useState<FilterEditState>({ op: 'eq', value: '', negated: false });
  const isMobile = useMediaQuery('(max-width: 768px)');

  const activeFilters = useMemo<ActiveFilter[]>(() => {
    if (!Array.isArray(query.filters)) {
      return [];
    }
    return query.filters.map((filter) => ({
      field: filter.field,
      op: filter.op,
      value: filter.value,
      negated: (filter.op === 'isNull' || filter.op === 'isEmpty') && filter.value === false,
    }));
  }, [query.filters]);

  const getField = (field: string) => fields.find((candidate) => candidate.field === field);
  const getFilter = (field: string) => activeFilters.find((filter) => filter.field === field);
  const availableOperators = useMemo(() => {
    if (!selectedField) {
      return [];
    }
    const field = getField(selectedField);
    return field ? (field.operators ?? getOperatorsForType(field.type)) : [];
  }, [fields, selectedField]);

  const selectField = (fieldName: string) => {
    setSelectedField(fieldName);
    const filter = getFilter(fieldName);
    if (filter) {
      setEditState({ op: filter.op, value: filter.value, negated: filter.negated ?? false });
      return;
    }
    const field = getField(fieldName);
    const operator = field ? (field.operators ?? getOperatorsForType(field.type))[0] : undefined;
    const defaultOperator = operator ?? 'eq';
    setEditState({
      op: defaultOperator,
      value: isNoValueOperator(defaultOperator) ? true : '',
      negated: false,
    });
  };

  const applyFilter = (field: string, state: FilterEditState) => {
    const filters = (query.filters ?? []).filter((filter) => filter.field !== field);
    const nextFilter: FilterSpec = { field, op: state.op, value: state.value };
    onQueryChange({ ...query, filters: [...filters, nextFilter], page: 1 });
  };

  const changeOperator = (operator: FilterOperator, negated: boolean) => {
    const nextState: FilterEditState = {
      op: operator,
      negated,
      value: isNoValueOperator(operator) ? !negated : editState.value,
    };
    setEditState(nextState);
    if (selectedField && isNoValueOperator(operator)) {
      applyFilter(selectedField, nextState);
    }
  };

  const removeFilter = (field: string) => {
    const filters = (query.filters ?? []).filter((filter) => filter.field !== field);
    onQueryChange({ ...query, filters: filters.length > 0 ? filters : undefined, page: 1 });
    if (selectedField === field) {
      setSelectedField(null);
    }
  };

  const clearFilters = () => {
    onQueryChange({ ...query, filters: undefined, page: 1 });
    setSelectedField(null);
  };

  return (
    <MultiFilterEditorView
      fields={fields}
      filters={activeFilters}
      selectedField={selectedField}
      editState={editState}
      availableOperators={availableOperators}
      filterBy={query.filterBy ?? 'AND'}
      allowLogicToggle={allowLogicToggle}
      opened={opened}
      isMobile={isMobile}
      badgeCount={activeFilters.length}
      placeholder={placeholder}
      applyMode="field"
      onOpenChange={setOpened}
      onClose={() => {
        setOpened(false);
        setSelectedField(null);
      }}
      onSelectField={selectField}
      onBackToFields={() => setSelectedField(null)}
      onRemoveFilter={removeFilter}
      onClearFilters={clearFilters}
      onEditStateChange={setEditState}
      onOperatorChange={changeOperator}
      onFilterByChange={(filterBy) => onQueryChange({ ...query, filterBy, page: 1 })}
      onApply={() => {
        if (selectedField) {
          applyFilter(selectedField, editState);
        }
      }}
    />
  );
}
