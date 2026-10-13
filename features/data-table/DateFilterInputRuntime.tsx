'use client';

import { componentBindings } from '@/components/core/bindings';
import { DateInput, type DateInputProps } from '@/components/core/Input';

export function DateFilterInputRuntime(props: DateInputProps) {
  return <DateInput {...componentBindings(props)} />;
}
