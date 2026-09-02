// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { LocalizationNoticeClient } from './LocalizationNoticeClient';

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
  window.localStorage.clear();
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
    root?.render(<MantineProvider>{node}</MantineProvider>);
  });
}

describe('LocalizationNoticeClient', () => {
  it('renders original-view link in subtle variant without translated return action', () => {
    render(
      <LocalizationNoticeClient
        dismissKey="test-localization-notice"
        variant="subtle"
        title="번역본"
        description="이 페이지를 현재 English로 표시하고 있습니다."
        tone="accent"
        dismissLabel="닫기"
        originalHref="/posts/example?lang=ko"
        originalLabel="원문 보기 (ko)"
        translatedHref={null}
        translatedLabel={null}
      />,
    );

    expect(container?.textContent).toContain('원문 보기 (ko)');
    expect(container?.textContent).not.toContain('English로 돌아가기');
  });

  it('uses the in-place original action without exposing a navigation href', () => {
    const onOriginalClick = vi.fn();
    render(
      <LocalizationNoticeClient
        dismissKey="test-localization-action"
        variant="subtle"
        title="Translated"
        description="Showing English."
        tone="accent"
        dismissLabel="Dismiss"
        originalHref="/posts/example?lang=ko"
        originalLabel="View original"
        onOriginalClick={onOriginalClick}
      />,
    );

    const originalAction = Array.from(container?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent === 'View original',
    );
    expect(originalAction?.getAttribute('href')).toBeNull();

    act(() => {
      originalAction?.click();
    });

    expect(onOriginalClick).toHaveBeenCalledOnce();
  });
});
