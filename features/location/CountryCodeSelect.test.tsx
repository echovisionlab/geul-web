// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { CountryCodeSelect } from './CountryCodeSelect';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('./ui/CountrySelect', () => ({
  CountrySelect: ({
    options,
    noResultsLabel,
    onChange,
    value,
  }: {
    options: Array<{
      value: string;
      label: string;
      code: string;
      name: string;
      nativeName?: string;
    }>;
    noResultsLabel: string;
    onChange: (value: string | null) => void;
    value: string | null;
  }) => {
    const taiwan = options.find((option) => option.value === 'TW') ?? options[0];
    const selected = options.find((option) => option.value === value) ?? null;

    return (
      <div
        data-current-value={value ?? ''}
        data-current-label={selected?.label ?? ''}
        data-nothing-found={noResultsLabel}
      >
        <div data-country-option>
          {taiwan?.code} {taiwan?.name} {taiwan?.nativeName}
        </div>
        <button type="button" onClick={() => onChange('TW')}>
          Pick Taiwan
        </button>
        <button type="button" onClick={() => onChange(null)}>
          Clear
        </button>
      </div>
    );
  },
}));

describe('CountryCodeSelect', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders searchable country options and normalizes clear changes to an empty code', () => {
    const onChange = vi.fn();

    act(() => {
      root.render(
        <TestProviders>
          <CountryCodeSelect value="" onChange={onChange} />
        </TestProviders>,
      );
    });

    expect(container.textContent).toContain('TW');
    expect(container.textContent).toContain('Taiwan');
    expect(container.textContent).toContain('台灣');
    expect(container.querySelector('[data-nothing-found]')?.getAttribute('data-nothing-found')).toBe(
      'No results found',
    );

    act(() => {
      container.querySelectorAll('button')[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onChange).toHaveBeenLastCalledWith('TW');

    act(() => {
      container.querySelectorAll('button')[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('passes a localized country label to the underlying select', () => {
    act(() => {
      root.render(
        <TestProviders locale="ko">
          <CountryCodeSelect value="KR" onChange={vi.fn()} />
        </TestProviders>,
      );
    });

    expect(container.querySelector('[data-current-label]')?.getAttribute('data-current-label')).toBe('대한민국');
  });
});
