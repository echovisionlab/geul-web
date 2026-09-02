// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import type { MaterializedEmailLayoutUnit } from '@echovisionlab/geul-common/collaboration/email-layout';
import { EmailLayoutTargetEditor } from './EmailLayoutTargetEditor';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { value?: string }) =>
    values?.value === undefined ? key : `${key}:${values.value}`,
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

function renderEditor(units: MaterializedEmailLayoutUnit[], onChange = vi.fn(), onUseSource = vi.fn()) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <MantineProvider>
        <EmailLayoutTargetEditor units={units} onChange={onChange} onUseSource={onUseSource} />
      </MantineProvider>,
    );
  });
  return { onChange, onUseSource };
}

describe('EmailLayoutTargetEditor', () => {
  it('shows source fallback without turning it into a locale-owned value', () => {
    const { onChange, onUseSource } = renderEditor([
      {
        handle: 'unit:11111111-1111-4111-8111-111111111111:text',
        kind: 'text',
        element: '',
        attribute: '',
        order: 0,
        sourceValue: 'Source heading',
        value: 'Source heading',
        localeValuePresent: false,
      },
    ]);

    const textarea = document.querySelector<HTMLTextAreaElement>(
      '[data-email-layout-unit="unit:11111111-1111-4111-8111-111111111111:text"]',
    );
    expect(textarea?.value).toBe('Source heading');
    const useSource = [...document.querySelectorAll('button')].find((button) => button.textContent === 'useSource');
    expect(useSource?.disabled).toBe(true);

    act(() => {
      if (!textarea) {
        throw new Error('textarea missing');
      }
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(textarea, '번역 제목');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith('unit:11111111-1111-4111-8111-111111111111:text', '번역 제목');
    expect(onUseSource).not.toHaveBeenCalled();
  });

  it('preserves explicit empty and exposes source fallback removal', () => {
    const { onUseSource } = renderEditor([
      {
        handle: 'unit:22222222-2222-4222-8222-222222222222:attr:aria-label',
        kind: 'attribute',
        element: 'button',
        attribute: 'aria-label',
        order: 0,
        sourceValue: 'Unsubscribe',
        value: '',
        localeValuePresent: true,
      },
    ]);

    expect(
      document.querySelector<HTMLTextAreaElement>(
        '[data-email-layout-unit="unit:22222222-2222-4222-8222-222222222222:attr:aria-label"]',
      )?.value,
    ).toBe('');
    const useSource = [...document.querySelectorAll('button')].find((button) => button.textContent === 'useSource');
    expect(useSource?.disabled).toBe(false);
    act(() => useSource?.click());
    expect(onUseSource).toHaveBeenCalledWith('unit:22222222-2222-4222-8222-222222222222:attr:aria-label');
  });
});
