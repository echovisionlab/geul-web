'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMediaQuery } from '@mantine/hooks';
import { getOperatorsForType, isNoValueOperator, type FilterOperator } from '@/lib/types/common/filter';
import type { TableFilterSpec } from '@/lib/utils/table-query';
import { buildFilterUrl, parseTableQuery } from '@/lib/utils/table-url';
import { MultiFilterEditorView } from '../MultiFilterEditorView';
import { type ActiveFilter, type FilterEditState, type FilterFieldConfig } from '../multi-filter-model';

export type { FilterFieldConfig } from '../multi-filter-model';

export interface ServerDataTableMultiFilterProps {
  namespace: string;
  fields: FilterFieldConfig[];
  placeholder?: string;
  allowLogicToggle?: boolean;
}

const filterUiState = new Map<string, { opened: boolean; selectedField: string | null }>();

function areActiveFiltersEqual(left: ActiveFilter[], right: ActiveFilter[]) {
  return (
    left.length === right.length &&
    left.every(
      (filter, index) =>
        filter.field === right[index]?.field &&
        filter.op === right[index]?.op &&
        filter.negated === right[index]?.negated &&
        JSON.stringify(filter.value) === JSON.stringify(right[index]?.value),
    )
  );
}

function toTableFilterSpec(filter: ActiveFilter): TableFilterSpec {
  return { field: filter.field, op: filter.op, value: filter.value };
}

function isFilterComplete(field: FilterFieldConfig, state: FilterEditState) {
  if (isNoValueOperator(state.op)) {
    return true;
  }
  if (state.op === 'in') {
    return Array.isArray(state.value) && state.value.length > 0;
  }
  if (state.op === 'between') {
    return (
      Array.isArray(state.value) &&
      state.value.length === 2 &&
      state.value.every((item) => item !== '' && item !== null && item !== undefined)
    );
  }
  if (field.type === 'boolean') {
    return typeof state.value === 'boolean';
  }
  return state.value !== '' && state.value !== null && state.value !== undefined;
}

export function ServerDataTableMultiFilter({
  namespace,
  fields,
  placeholder,
  allowLogicToggle = true,
}: ServerDataTableMultiFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [opened, setOpened] = useState(() => filterUiState.get(namespace)?.opened ?? false);
  const [selectedField, setSelectedField] = useState<string | null>(
    () => filterUiState.get(namespace)?.selectedField ?? null,
  );
  const [closeAfterSuccess, setCloseAfterSuccess] = useState(false);
  const [editState, setEditState] = useState<FilterEditState>({ op: 'eq', value: '', negated: false });
  const lastSyncedQueryKeyRef = useRef<string | null>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

  useEffect(() => {
    filterUiState.set(namespace, { opened, selectedField });
  }, [namespace, opened, selectedField]);

  useEffect(() => {
    if (!isPending && closeAfterSuccess) {
      setCloseAfterSuccess(false);
      setOpened(false);
      setSelectedField(null);
    }
  }, [closeAfterSuccess, isPending]);

  const currentQuery = parseTableQuery(searchParams, namespace);
  const currentFilterBy = currentQuery.filterBy ?? 'AND';
  const activeFilters = useMemo<ActiveFilter[]>(() => {
    if (!Array.isArray(currentQuery.filters)) {
      return [];
    }
    return currentQuery.filters.map((filter) => ({
      field: filter.field,
      op: filter.op as FilterOperator,
      value: filter.value,
      negated: (filter.op === 'isNull' || filter.op === 'isEmpty') && filter.value === false,
    }));
  }, [currentQuery.filters]);
  const currentQueryKey = useMemo(
    () => JSON.stringify({ filters: activeFilters, filterBy: currentFilterBy }),
    [activeFilters, currentFilterBy],
  );
  const [draftFilters, setDraftFilters] = useState<ActiveFilter[]>(activeFilters);
  const [draftFilterBy, setDraftFilterBy] = useState<'AND' | 'OR'>(currentFilterBy);
  const hasDraftChanges = draftFilterBy !== currentFilterBy || !areActiveFiltersEqual(draftFilters, activeFilters);

  useEffect(() => {
    lastSyncedQueryKeyRef.current ??= currentQueryKey;
  }, [currentQueryKey]);

  useEffect(() => {
    if (isPending || opened || currentQueryKey === lastSyncedQueryKeyRef.current) {
      return;
    }
    setDraftFilters(activeFilters);
    setDraftFilterBy(currentFilterBy);
    lastSyncedQueryKeyRef.current = currentQueryKey;
  }, [activeFilters, currentFilterBy, currentQueryKey, isPending, opened]);

  const getField = (field: string) => fields.find((candidate) => candidate.field === field);
  const getDraftFilter = (field: string) => draftFilters.find((filter) => filter.field === field);
  const availableOperators = useMemo(() => {
    if (!selectedField) {
      return [];
    }
    const field = getField(selectedField);
    return field ? (field.operators ?? getOperatorsForType(field.type)) : [];
  }, [fields, selectedField]);

  const updateDraftFilter = (fieldName: string, state: FilterEditState) => {
    const field = getField(fieldName);
    if (!field) {
      return;
    }
    setDraftFilters((current) => {
      const next = current.filter((filter) => filter.field !== fieldName);
      return isFilterComplete(field, state)
        ? [...next, { field: fieldName, op: state.op, value: state.value, negated: state.negated }]
        : next;
    });
  };

  const selectField = (fieldName: string) => {
    setSelectedField(fieldName);
    const filter = getDraftFilter(fieldName);
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

  const changeOperator = (operator: FilterOperator, negated: boolean) => {
    const nextState: FilterEditState = {
      op: operator,
      negated,
      value: isNoValueOperator(operator) ? !negated : editState.value,
    };
    setEditState(nextState);
    if (selectedField) {
      updateDraftFilter(selectedField, nextState);
    }
  };

  const changeEditState = (nextState: FilterEditState) => {
    setEditState(nextState);
    if (selectedField) {
      updateDraftFilter(selectedField, nextState);
    }
  };

  const removeFilter = (fieldName: string) => {
    setDraftFilters((current) => current.filter((filter) => filter.field !== fieldName));
    if (selectedField === fieldName) {
      const field = getField(fieldName);
      const operator = field ? (field.operators ?? getOperatorsForType(field.type))[0] : undefined;
      const defaultOperator = operator ?? 'eq';
      setEditState({
        op: defaultOperator,
        value: isNoValueOperator(defaultOperator) ? true : '',
        negated: false,
      });
    }
  };

  const applyFilters = () => {
    const filters = draftFilters.length > 0 ? draftFilters.map(toTableFilterSpec) : undefined;
    setCloseAfterSuccess(true);
    const url = buildFilterUrl(namespace, searchParams, filters, filters ? draftFilterBy : undefined, pathname);
    startTransition(() => router.push(url, { scroll: false }));
  };

  return (
    <MultiFilterEditorView
      fields={fields}
      filters={draftFilters}
      selectedField={selectedField}
      editState={editState}
      availableOperators={availableOperators}
      filterBy={draftFilterBy}
      allowLogicToggle={allowLogicToggle}
      opened={opened}
      isMobile={isMobile}
      badgeCount={activeFilters.length}
      placeholder={placeholder}
      disabled={isPending}
      applyMode="all"
      hasChanges={hasDraftChanges}
      valueInputWithinPortal={false}
      onOpenChange={setOpened}
      onClose={() => {
        setOpened(false);
        setSelectedField(null);
      }}
      onSelectField={selectField}
      onBackToFields={() => setSelectedField(null)}
      onRemoveFilter={removeFilter}
      onClearFilters={() => {
        setDraftFilters([]);
        setDraftFilterBy('AND');
      }}
      onEditStateChange={changeEditState}
      onOperatorChange={changeOperator}
      onFilterByChange={setDraftFilterBy}
      onApply={applyFilters}
    />
  );
}
