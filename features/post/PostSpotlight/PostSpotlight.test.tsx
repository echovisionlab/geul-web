// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

function Runtime({ openRequest }: { openRequest: number }) {
  mocks.render(openRequest);
  return <div role="dialog">Search</div>;
}

async function mount() {
  await act(async () => root.render(<PostSpotlight />));
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

describe('PostSpotlight demand loading', () => {
  it('renders no search UI or runtime on SSR and idle hydration', async () => {
    expect(renderToStaticMarkup(<PostSpotlight />)).toBe('');
    await mount();
    expect(mocks.load).not.toHaveBeenCalled();
    expect(host.innerHTML).toBe('');
  });

  it('loads and opens on the first shell gesture, coalescing concurrent requests', async () => {
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
    expect(host.innerHTML).toBe('');
    await act(async () => resolve(Runtime));
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    expect(mocks.render).toHaveBeenLastCalledWith(2);
    await act(async () => openPostSpotlight());
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(mocks.render).toHaveBeenLastCalledWith(3);
  });

  it('preserves a gesture before the listener is mounted', async () => {
    openPostSpotlight();
    await mount();
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
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
    root = createRoot(host);
  });

  it('shows an import failure and allows retry', async () => {
    mocks.load.mockRejectedValueOnce(new Error('chunk unavailable')).mockResolvedValue(Runtime);
    await mount();
    await act(async () => openPostSpotlight());
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('errors.generic');
    await act(async () => (host.querySelector('button') as HTMLButtonElement).click());
    expect(mocks.load).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('recovers a renderer failure on retry without loading forever', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let fail = true;
    mocks.load.mockResolvedValue(() => {
      if (fail) {
        throw new Error('render failed');
      }
      return <Runtime openRequest={1} />;
    });
    await mount();
    await act(async () => openPostSpotlight());
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    fail = false;
    await act(async () => (host.querySelector('button') as HTMLButtonElement).click());
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    expect(mocks.load).toHaveBeenCalledTimes(1);
    errorLog.mockRestore();
  });
});
