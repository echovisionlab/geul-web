'use client';

import { useTranslations } from 'next-intl';
import {
  MultiSelectComboboxView,
  type MultiSelectComboboxViewProps,
  type MultiSelectItem,
} from '@/components/core/Input';

export interface MultiSelectComboboxProps<T extends MultiSelectItem> extends Omit<
  MultiSelectComboboxViewProps<T>,
  'createOptionLabel' | 'loadingLabel'
> {}

/** Supplies semantic create-option copy for post taxonomy selectors. */
export function MultiSelectCombobox<T extends MultiSelectItem>(props: MultiSelectComboboxProps<T>) {
  const tCommonActions = useTranslations('common.actions');
  const tCommonStates = useTranslations('common.states');

  return (
    <MultiSelectComboboxView
      {...props}
      loadingLabel={tCommonStates('loading')}
      createOptionLabel={(name) => `+ ${tCommonActions('createNamed', { name })}`}
    />
  );
}

export type { MultiSelectItem };
