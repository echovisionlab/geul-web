'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { SegmentedControl } from '@/components/core/Input';

export interface IconViewModeOption<T extends string> {
  value: T;
  icon: ReactNode;
  tooltip: string;
}

interface IconViewModeControlProps<T extends string> {
  value: T;
  options: IconViewModeOption<T>[];
  onChange: (value: T) => void;
}

/** Exclusive editor view modes use Core SegmentedControl icon options. */
export function IconViewModeControl<T extends string>({ value, options, onChange }: IconViewModeControlProps<T>) {
  const tActions = useTranslations('common.actions');
  return (
    <SegmentedControl
      aria-label={tActions('view')}
      value={value}
      onChange={(nextValue) => onChange(nextValue as T)}
      data={options.map((option) => ({ value: option.value, icon: option.icon, accessibleLabel: option.tooltip }))}
    />
  );
}
