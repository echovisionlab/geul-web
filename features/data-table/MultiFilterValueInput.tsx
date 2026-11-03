'use client';

import {
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';

import type { DateInputProps } from '@/components/core/Input';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { MultiSelect } from '@/components/core/Input/MultiSelect';
import { NumberInput } from '@/components/core/Input/NumberInput';
import { Radio } from '@/components/core/Input/Radio';
import { TextInput } from '@/components/core/Input/TextInput';
import { isNoValueOperator } from '@/lib/types/common/filter';
import type { FilterEditState, FilterFieldConfig } from './multi-filter-model';

const DateInput = dynamic<DateInputProps>(
  () => import('./DateFilterInputRuntime').then((module) => module.DateFilterInputRuntime),
  { loading: DateInputLoading },
);

function DateInputLoading() {
  const t = useTranslations('common.states');
  return <TextInput size="xs" disabled aria-busy="true" aria-label={t('loading')} placeholder={t('loading')} />;
}

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
  withinPortal: _withinPortal,
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
        <DsLayoutStack gap="xs">
          <DateInput
            label={labels.from}
            size="xs"
            value={fromValue ? new Date(fromValue) : null}
            onChange={(next) => updateValue([next ?? '', toValue])}
            clearable
            disabled={disabled}
          />
          <DateInput
            label={labels.to}
            size="xs"
            value={toValue ? new Date(toValue) : null}
            onChange={(next) => updateValue([fromValue, next ?? ''])}
            clearable
            disabled={disabled}
          />
        </DsLayoutStack>
      );
    }

    return (
      <DsLayoutStack gap="xs">
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
      </DsLayoutStack>
    );
  }

  if (field.type === 'date') {
    return (
      <DateInput
        label={labels.value}
        size="xs"
        value={value ? new Date(value as string) : null}
        onChange={(next) => updateValue(next ?? '')}
        clearable
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
        <DsLayoutInset blockStart="xs">
          <DsLayoutInline>
            <Radio value="true" label={labels.trueValue} disabled={disabled} />
            <Radio value="false" label={labels.falseValue} disabled={disabled} />
          </DsLayoutInline>
        </DsLayoutInset>
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
