'use client';

import { type TranslationLocaleSelectOption } from '@/features/translation/locale-option-format';
import { TranslationLocaleControl } from '@/features/translation/TranslationLocaleControl';

interface EditorActiveLocaleMenuProps {
  activeLocale: string | null;
  activeLocaleLabel: string | null;
  sourceLocale: string | null;
  localeOptions: TranslationLocaleSelectOption[];
  onChange: (locale: string) => void;
  disabled?: boolean;
}

export function EditorActiveLocaleMenu({
  activeLocale,
  activeLocaleLabel,
  sourceLocale,
  localeOptions,
  onChange,
  disabled = false,
}: EditorActiveLocaleMenuProps) {
  return (
    <TranslationLocaleControl
      variant="menu"
      value={activeLocale}
      fallbackLabel={activeLocaleLabel}
      sourceLocale={sourceLocale}
      options={localeOptions}
      onChange={(locale) => {
        if (locale) {
          onChange(locale);
        }
      }}
      disabled={disabled}
    />
  );
}
