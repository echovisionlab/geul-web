'use client';

import { DateInput, type DateInputProps } from '@mantine/dates';
import '@mantine/dates/styles.css';

export function DateFilterInputRuntime(props: DateInputProps) {
  return <DateInput {...props} />;
}
