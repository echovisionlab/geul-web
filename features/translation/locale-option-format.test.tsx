// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useFormatTranslationLocaleOptionLabel,
  useTranslationLocaleSelectData,
  type TranslationLocaleSelectOption,
} from './locale-option-format';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    if (key === 'sourceOption') {
      return `${values?.locale ?? ''} (원문)`;
    }
    return key;
  },
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let latestLabel: string | null = null;
let latestData: Array<{
  value: string;
  label: string;
}> | null = null;

function HookProbe({
  option,
  options,
  sourceLocale,
}: {
  option: TranslationLocaleSelectOption;
  options: readonly TranslationLocaleSelectOption[];
  sourceLocale: string | null | undefined;
}) {
  const formatOptionLabel = useFormatTranslationLocaleOptionLabel();
  latestLabel = formatOptionLabel(option, sourceLocale);
  latestData = useTranslationLocaleSelectData(options, sourceLocale);
  return null;
}

function render(node: React.ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(node);
  });
}

beforeEach(() => {
  latestLabel = null;
  latestData = null;
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

describe('locale-option-format', () => {
  it('marks normalized source locales as source options', () => {
    render(
      <HookProbe
        option={{ value: 'pt_BR', label: 'Português (Brasil)' }}
        options={[
          { value: 'pt_BR', label: 'Português (Brasil)' },
          { value: 'en', label: 'English' },
        ]}
        sourceLocale="pt-BR"
      />,
    );

    expect(latestLabel).toBe('Português (Brasil) (원문)');
    expect(latestData).toEqual([
      { value: 'pt_BR', label: 'Português (Brasil) (원문)' },
      { value: 'en', label: 'English' },
    ]);
  });

  it('respects explicit source markers even when the locale value differs', () => {
    render(
      <HookProbe
        option={{ value: 'en', label: 'English', isSource: true }}
        options={[
          { value: 'en', label: 'English', isSource: true },
          { value: 'ko', label: '한국어' },
        ]}
        sourceLocale="ko"
      />,
    );

    expect(latestLabel).toBe('English (원문)');
    expect(latestData).toEqual([
      { value: 'en', label: 'English (원문)' },
      { value: 'ko', label: '한국어 (원문)' },
    ]);
  });

  it('leaves non-source locales unchanged', () => {
    render(
      <HookProbe
        option={{ value: 'ja', label: '日本語' }}
        options={[{ value: 'ja', label: '日本語' }]}
        sourceLocale="en"
      />,
    );

    expect(latestLabel).toBe('日本語');
    expect(latestData).toEqual([{ value: 'ja', label: '日本語' }]);
  });
});
