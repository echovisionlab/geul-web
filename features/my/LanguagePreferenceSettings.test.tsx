// @vitest-environment jsdom

import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import koMessages from '@/messages/ko.json';
import { LanguagePreferenceSettings } from './LanguagePreferenceSettings';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock('@/lib/actions/user-preference', () => ({
  updatePreferredLocaleAction: vi.fn(),
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

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

function render(node: React.ReactNode) {
  const queryClient = new QueryClient();

  act(() => {
    root?.render(
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider locale="ko" messages={koMessages}>
          <MantineProvider>{node}</MantineProvider>
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );
  });
}

describe('LanguagePreferenceSettings', () => {
  it('renders translated static copy from next-intl messages', () => {
    render(<LanguagePreferenceSettings initialLocale="ko" />);

    expect(container?.textContent).toContain('계정 언어는 로그인하는 모든 기기에서 동일하게 적용됩니다.');
    expect(container?.textContent).toContain('선호 언어');
    expect(container?.textContent).toContain('언어 저장');
  });
});
