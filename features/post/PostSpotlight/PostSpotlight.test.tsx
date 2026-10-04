// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostSpotlightRuntimeProps } from './PostSpotlightRuntime';

const mocks = vi.hoisted(() => ({ load: vi.fn(), render: vi.fn() }));
vi.mock('./post-spotlight-runtime-loader', () => ({ loadPostSpotlightRuntime: mocks.load }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/components/core/Alert', () => ({
  Alert: ({ children, onClose }: { children: ReactNode; onClose: () => void }) => (
    <div role="alert">
      {children}
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));
vi.mock('@/components/core/Button', () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));
import { PostSpotlight } from './PostSpotlight';
import { consumePostSpotlightOpen, openPostSpotlight } from './post-spotlight-trigger';

let root: Root;
let host: HTMLDivElement;
function Runtime(props: PostSpotlightRuntimeProps) {
  mocks.render(props);
  return <div data-search-results="">Search results</div>;
}
async function mount() {
  await act(async () =>
    root.render(
      <MantineProvider env="test">
        <PostSpotlight />
      </MantineProvider>,
    ),
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  consumePostSpotlightOpen();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  mocks.load.mockResolvedValue(Runtime);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe('PostSpotlight demand-loaded results', () => {
  it('renders no dialog or results runtime on SSR and idle hydration', async () => {
    const html = renderToStaticMarkup(
      <MantineProvider env="test">
        <PostSpotlight />
      </MantineProvider>,
    );
    expect(html).not.toContain('role="dialog"');
    await mount();
    expect(mocks.load).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('opens its real input immediately and coalesces concurrent results imports', async () => {
    let resolve!: (runtime: typeof Runtime) => void;
    mocks.load.mockReturnValue(
      new Promise<typeof Runtime>((done) => {
        resolve = done;
      }),
    );
    await mount();
    await act(async () => {
      openPostSpotlight();
      openPostSpotlight();
    });
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    const input = document.querySelector('input[placeholder="searchPosts"]');
    expect(input).not.toBeNull();
    expect(mocks.render).not.toHaveBeenCalled();
    await act(async () => resolve(Runtime));
    expect(document.querySelector('[data-search-results]')).not.toBeNull();
    expect(document.querySelector('input[placeholder="searchPosts"]')).toBe(input);
    await act(async () => openPostSpotlight());
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  });

  it('preserves a gesture before the listener mounts', async () => {
    openPostSpotlight();
    await mount();
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it.each(['ctrlKey', 'metaKey'] as const)('opens with %s+K and ignores editing controls', async (modifier) => {
    await mount();
    const input = document.createElement('input');
    host.append(input);
    await act(async () =>
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', [modifier]: true, bubbles: true })),
    );
    expect(mocks.load).not.toHaveBeenCalled();
    await act(async () =>
      document.documentElement.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', [modifier]: true, bubbles: true }),
      ),
    );
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(document.querySelector('input[placeholder="searchPosts"]')).not.toBeNull();
  });

  it('ignores pending completion after unmount', async () => {
    let resolve!: (runtime: typeof Runtime) => void;
    mocks.load.mockReturnValue(
      new Promise<typeof Runtime>((done) => {
        resolve = done;
      }),
    );
    await mount();
    await act(async () => openPostSpotlight());
    await act(async () => root.unmount());
    await act(async () => resolve(Runtime));
    expect(mocks.render).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    root = createRoot(host);
  });

  it('shows import failures inside the same dialog and allows retry', async () => {
    mocks.load.mockRejectedValueOnce(new Error('chunk unavailable')).mockResolvedValue(Runtime);
    await mount();
    await act(async () => openPostSpotlight());
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('errors.generic');
    const retry = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'actions.tryAgain',
    )!;
    await act(async () => retry.click());
    expect(mocks.load).toHaveBeenCalledTimes(2);
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(document.querySelector('[data-search-results]')).not.toBeNull();
  });

  it('recovers renderer errors on retry without replacing the input', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let fail = true;
    mocks.load.mockResolvedValue((props: PostSpotlightRuntimeProps) => {
      if (fail) {
        throw new Error('render failed');
      }
      return <Runtime {...props} />;
    });
    try {
      await mount();
      await act(async () => openPostSpotlight());
      const input = document.querySelector('input[placeholder="searchPosts"]');
      expect(document.querySelector('[role="alert"]')).not.toBeNull();
      fail = false;
      const retry = Array.from(document.querySelectorAll('button')).find(
        (button) => button.textContent === 'actions.tryAgain',
      )!;
      await act(async () => retry.click());
      expect(document.querySelector('[data-search-results]')).not.toBeNull();
      expect(document.querySelector('input[placeholder="searchPosts"]')).toBe(input);
      expect(mocks.load).toHaveBeenCalledTimes(1);
    } finally {
      errorLog.mockRestore();
    }
  });
});
