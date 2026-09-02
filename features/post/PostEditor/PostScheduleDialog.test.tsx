// @vitest-environment jsdom

import { act } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import enMessages from '@/messages/en.json';
import { PostScheduleDialog } from './PostScheduleDialog';

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('PostScheduleDialog', () => {
  it('shows the persisted IANA zone, UTC instant and DST notice for a scheduled Post', () => {
    const onSubmit = vi.fn();
    const futureInstant = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    act(() => {
      root?.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <MantineProvider env="test">
            <PostScheduleDialog
              opened
              onClose={vi.fn()}
              onSubmit={onSubmit}
              initialInstant={futureInstant}
              initialTimeZone="Asia/Seoul"
            />
          </MantineProvider>
        </NextIntlClientProvider>,
      );
    });

    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
    const resolution = document.body.querySelector<HTMLElement>('[data-testid="post-schedule-resolution"]');
    expect(dialog?.textContent).toContain('Reschedule post');
    expect(dialog?.textContent).toContain('Asia/Seoul');
    expect(resolution?.textContent).toContain('UTC');
    expect(resolution?.textContent).toContain('daylight-saving');
    expect(dialog?.querySelector('[data-dates-input]')?.textContent).not.toBe('');
    expect(dialog?.querySelector('input[aria-label="Hours"]')).not.toBeNull();
    expect(dialog?.querySelector('input[aria-label="Minutes"]')).not.toBeNull();
    expect(dialog?.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
  });
});
