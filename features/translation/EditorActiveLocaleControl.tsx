'use client';

import type { TranslationLocaleSelectOption } from './locale-option-format';
import { EditorActiveLocaleMenu } from './EditorActiveLocaleMenu';

interface ActiveEditLocaleControlState {
  isControlVisible: boolean;
  isLoading: boolean;
  activeLocale: string | null;
  activeLocaleLabel: string | null;
  sourceLocale: string | null;
  localeOptions: TranslationLocaleSelectOption[];
  setActiveLocale: (locale: string) => void;
}

interface EditorActiveLocaleControlProps {
  state: ActiveEditLocaleControlState;
  hidden?: boolean;
}

export function EditorActiveLocaleControl({ state, hidden = false }: EditorActiveLocaleControlProps) {
  if (hidden || !state.isControlVisible) {
    return null;
  }

  return (
    <EditorActiveLocaleMenu
      activeLocale={state.activeLocale}
      activeLocaleLabel={state.activeLocaleLabel}
      sourceLocale={state.sourceLocale}
      localeOptions={state.localeOptions}
      onChange={state.setActiveLocale}
      disabled={state.isLoading}
    />
  );
}
