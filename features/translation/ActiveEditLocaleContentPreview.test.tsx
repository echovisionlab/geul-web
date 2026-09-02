// @vitest-environment jsdom

import { act } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MantineProvider } from '@mantine/core';
import koMessages from '@/messages/ko.json';
import { ActiveEditLocaleContentPreview } from './ActiveEditLocaleContentPreview';

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
  act(() => {
    root?.render(
      <NextIntlClientProvider locale="ko" messages={koMessages}>
        <MantineProvider>{node}</MantineProvider>
      </NextIntlClientProvider>,
    );
  });
}

describe('ActiveEditLocaleContentPreview', () => {
  it('keeps target content labeled as a read-only preview when custom rendering is provided', () => {
    render(
      <ActiveEditLocaleContentPreview localeLabel="한국어" hasLiveRow contentPreview="translated preview">
        <div>editor body</div>
      </ActiveEditLocaleContentPreview>,
    );

    expect(container?.textContent).toContain('한국어 본문 미리보기');
    expect(container?.textContent).toContain('기존 번역 문서를 구조와 서식을 유지한 채 표시합니다.');
    expect(container?.textContent).toContain('editor body');
  });
});
