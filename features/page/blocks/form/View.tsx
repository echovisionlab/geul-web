'use client';

import type { BlockViewProps } from '../types';
import { parseFormProps } from './schema';
import { FormViewClient } from './ViewClient';

export function FormView({ props, requestedLocale, preview = false }: BlockViewProps & { preview?: boolean }) {
  const parsedProps = parseFormProps(props);

  return <FormViewClient props={parsedProps} requestedLocale={requestedLocale} preview={preview} />;
}
