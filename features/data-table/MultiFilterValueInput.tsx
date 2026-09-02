'use client';

import { Group, Stack } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { MultiSelect, NumberInput, Radio, TextInput } from '@/components/core/Input';
import { isNoValueOperator } from '@/lib/types/common/filter';
import type { FilterEditState, FilterFieldConfig } from './multi-filter-model';

interface Labels {
  value: string;
  values: string;
  from: string;
  to: string;
  selectValues: string;
  enterValue: string;
  trueValue: string;
  falseValue: string;
}

interface Props {
  field: FilterFieldConfig | null;
  state: FilterEditState;
  onChange: (state: FilterEditState) => void;
  labels: Labels;
  disabled?: boolean;
  withinPortal?: boolean;
}

export function MultiFilterValueInput({
  field,
  state,
  onChange,
  labels,
  disabled = false,
  withinPortal = true,
}: Props) {
  if (!field || isNoValueOperator(state.op)) {
    return null;
  }

  const { op, value } = state;
  const updateValue = (nextValue: unknown) => onChange({ ...state, value: nextValue });

  if (op === 'in') {
    return (
      <MultiSelect
        label={labels.values}
        size="xs"
        data={field.options ?? []}
        value={Array.isArray(value) ? (value as string[]) : []}
        onChange={updateValue}
        placeholder={labels.selectValues}
        searchable
        clearable
        comboboxProps={{ withinPortal }}
        disabled={disabled}
      />
    );
  }

  if (op === 'between') {
    const betweenValue = Array.isArray(value) ? value : ['', ''];
    const fromValue = String(betweenValue[0] ?? '');
    const toValue = String(betweenValue[1] ?? '');

    if (field.type === 'date') {
      return (
        <Stack gap="xs">
          <DateInput
            label={labels.from}
            size="xs"
            valueFormat="YYYY-MM-DD"
            value={fromValue ? new Date(fromValue) : null}
            onChange={(next) => updateValue([next ?? '', toValue])}
            clearable
            popoverProps={{ withinPortal }}
            disabled={disabled}
          />
          <DateInput
            label={labels.to}
            size="xs"
            valueFormat="YYYY-MM-DD"
            value={toValue ? new Date(toValue) : null}
            onChange={(next) => updateValue([fromValue, next ?? ''])}
            clearable
            popoverProps={{ withinPortal }}
            disabled={disabled}
          />
        </Stack>
      );
    }

    return (
      <Stack gap="xs">
        <NumberInput
          label={labels.from}
          size="xs"
          value={fromValue === '' ? '' : Number(fromValue)}
          onChange={(next) => updateValue([next ?? '', toValue])}
          disabled={disabled}
        />
        <NumberInput
          label={labels.to}
          size="xs"
          value={toValue === '' ? '' : Number(toValue)}
          onChange={(next) => updateValue([fromValue, next ?? ''])}
          disabled={disabled}
        />
      </Stack>
    );
  }

  if (field.type === 'date') {
    return (
      <DateInput
        label={labels.value}
        size="xs"
        valueFormat="YYYY-MM-DD"
        value={value ? new Date(value as string) : null}
        onChange={(next) => updateValue(next ?? '')}
        clearable
        popoverProps={{ withinPortal }}
        disabled={disabled}
      />
    );
  }

  if (field.type === 'number') {
    return (
      <NumberInput
        label={labels.value}
        size="xs"
        value={value === '' ? '' : Number(value)}
        onChange={(next) => updateValue(next ?? '')}
        disabled={disabled}
      />
    );
  }

  if (field.type === 'boolean') {
    return (
      <Radio.Group
        label={labels.value}
        size="xs"
        value={String(value)}
        onChange={(next) => updateValue(next === 'true')}
      >
        <Group mt="xs">
          <Radio value="true" label={labels.trueValue} disabled={disabled} />
          <Radio value="false" label={labels.falseValue} disabled={disabled} />
        </Group>
      </Radio.Group>
    );
  }

  return (
    <TextInput
      label={labels.value}
      size="xs"
      value={String(value ?? '')}
      onChange={(event) => updateValue(event.target.value)}
      placeholder={labels.enterValue}
      disabled={disabled}
    />
  );
}
