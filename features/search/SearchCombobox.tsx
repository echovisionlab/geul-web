'use client';

import { useTranslations } from 'next-intl';
import { SearchComboboxView, type SearchComboboxViewProps } from '@/components/core/Input';

export interface SearchComboboxProps<T> extends Omit<
  SearchComboboxViewProps<T>,
  'minimumQueryMessage' | 'noResultsMessage'
> {}

/** Supplies localized empty-state copy to the pure Core search combobox. */
export function SearchCombobox<T>(props: SearchComboboxProps<T>) {
  const t = useTranslations('searchCombobox');
  const minimumQueryLength = props.minQueryLength ?? 2;

  return (
    <SearchComboboxView
      {...props}
      minimumQueryMessage={t('typeAtLeast', { count: minimumQueryLength })}
      noResultsMessage={t('noResults')}
    />
  );
}
