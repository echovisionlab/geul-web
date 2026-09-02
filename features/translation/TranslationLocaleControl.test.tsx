// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { TranslationLocaleControl } from './TranslationLocaleControl';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    switch (key) {
      case 'source':
        return '원문';
      case 'translations':
        return '번역';
      case 'sourceOption':
        return `${values?.locale ?? ''} (원문)`;
      case 'loading':
        return 'Loading locale';
      case 'label':
        return 'Editing locale';
      case 'ariaLabel':
        return `Edit locale: ${values?.locale ?? ''}`;
      default:
        return key;
    }
  },
}));

vi.mock('@/components/core/Input', () => ({
  NativeSelect: ({
    data,
    value,
    onChange,
    'aria-label': ariaLabel,
  }: {
    data: Array<{ value: string; label: string } | { group: string; items: Array<{ value: string; label: string }> }>;
    value: string | null;
    onChange: React.ChangeEventHandler<HTMLSelectElement>;
    'aria-label'?: string;
  }) => (
    <select
      data-testid="translation-native-select"
      aria-label={ariaLabel ?? 'Translation native select'}
      value={value ?? ''}
      onChange={onChange}
    >
      <option value="">None</option>
      {data.map((option) =>
        'group' in option ? (
          <optgroup key={option.group} label={option.group}>
            {option.items.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </optgroup>
        ) : (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ),
      )}
    </select>
  ),
  Select: ({
    data,
    value,
    onChange,
    'aria-label': ariaLabel,
  }: {
    data: Array<{ value: string; label: string } | { group: string; items: Array<{ value: string; label: string }> }>;
    value: string | null;
    onChange: (value: string | null) => void;
    'aria-label'?: string;
  }) => (
    <select
      data-testid="translation-select"
      aria-label={ariaLabel ?? 'Translation select'}
      value={value ?? ''}
      onChange={(event) => onChange(event.currentTarget.value || null)}
    >
      <option value="">None</option>
      {data.map((option) =>
        'group' in option ? (
          <optgroup key={option.group} label={option.group}>
            {option.items.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </optgroup>
        ) : (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ),
      )}
    </select>
  ),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  }),
});

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function render(node: React.ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(<MantineProvider>{node}</MantineProvider>);
  });
}

beforeEach(() => {
  container = null;
  root = null;
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

describe('TranslationLocaleControl', () => {
  it('returns null when there are no locale options', () => {
    render(<TranslationLocaleControl variant="menu" options={[]} sourceLocale="en" value="en" onChange={() => {}} />);

    expect(container?.querySelector('button, select')).toBeNull();
  });

  it('shows a source-aware fallback label for menu controls when the active option is missing', () => {
    render(
      <TranslationLocaleControl
        variant="menu"
        options={[{ value: 'en', label: 'English' }]}
        sourceLocale="ko"
        value="ko"
        fallbackLabel="한국어"
        onChange={() => {}}
      />,
    );

    expect(container?.textContent).toContain('한국어 (원문)');
    expect(container?.textContent).not.toContain('Loading locale');
  });

  it('formats select variant options, groups source first, and forwards selected locales', () => {
    const onChange = vi.fn();

    render(
      <TranslationLocaleControl
        variant="select"
        options={[
          { value: 'en', label: 'English' },
          { value: 'ko', label: '한국어' },
        ]}
        sourceLocale="ko"
        value="en"
        onChange={onChange}
      />,
    );

    const select = container?.querySelector('select[data-testid="translation-select"]') as HTMLSelectElement | null;

    expect(select).not.toBeNull();
    expect(Array.from(select?.querySelectorAll('optgroup') ?? []).map((group) => group.label)).toEqual([
      '원문',
      '번역',
    ]);
    expect(Array.from(select?.options ?? []).map((option) => option.textContent)).toEqual([
      'None',
      '한국어 (원문)',
      'English',
    ]);

    act(() => {
      if (!select) {
        return;
      }
      select.value = 'ko';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith('ko');
  });

  it('normalizes blank native-select changes back to null', () => {
    const onChange = vi.fn();

    render(
      <TranslationLocaleControl
        variant="native-select"
        options={[
          { value: 'en', label: 'English' },
          { value: 'ko', label: '한국어' },
        ]}
        sourceLocale="en"
        value="en"
        onChange={onChange}
      />,
    );

    const select = container?.querySelector('select') as HTMLSelectElement | null;
    expect(select).not.toBeNull();

    act(() => {
      if (!select) {
        return;
      }
      select.value = '';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
