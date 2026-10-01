// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NavigationLink } from '@/components/core/Navigation';
import { registerEditorSave } from '@/lib/editor/editor-save-registry';
import { notifications } from '@mantine/notifications';
import { EditorNavigationProvider } from './EditorNavigationProvider';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  show: vi.fn(),
  onNavigate: null as null | ((event: { preventDefault: () => void }) => void),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => `common.notifications.${key}` }));
vi.mock('@mantine/notifications', () => ({ notifications: { show: mocks.show } }));
vi.mock('next/link', async () => {
  const React = await import('react');

  const MockNextLink = React.forwardRef<HTMLAnchorElement, Record<string, unknown>>((props, ref) => {
    const {
      href,
      onNavigate,
      children,
      replace,
      scroll,
      prefetch,
      locale,
      shallow,
      passHref,
      legacyBehavior,
      transitionTypes,
      ...anchorProps
    } = props;
    mocks.onNavigate = onNavigate as typeof mocks.onNavigate;

    return React.createElement(
      'a',
      {
        ...(anchorProps as import('react').AnchorHTMLAttributes<HTMLAnchorElement>),
        href: typeof href === 'string' ? href : '/object-href',
        ref,
      },
      children as ReactNode,
    );
  });

  return { default: MockNextLink };
});

let host: HTMLDivElement;
let root: Root;
const unregisterSaves: Array<() => void> = [];

beforeEach(() => {
  mocks.push.mockReset();
  mocks.replace.mockReset();
  mocks.show.mockReset();
  mocks.onNavigate = null;
  unregisterSaves.length = 0;
  window.sessionStorage.clear();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  for (const unregister of unregisterSaves) {
    unregister();
  }
  window.sessionStorage.clear();
  host.remove();
  vi.restoreAllMocks();
});

function render(node: ReactNode) {
  act(() => root.render(<EditorNavigationProvider>{node}</EditorNavigationProvider>));
}

function navigate(event: { preventDefault: () => void }) {
  if (!mocks.onNavigate) {
    throw new Error('Next Link did not receive the navigation callback');
  }
  act(() => mocks.onNavigate?.(event));
}

describe('EditorNavigationProvider', () => {
  it('leaves ordinary navigation to Next when no editor save is pending', () => {
    render(<NavigationLink href="/outside">Outside editor</NavigationLink>);

    const preventDefault = vi.fn();
    navigate({ preventDefault });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('waits for a deferred save and then uses replace and scroll options', async () => {
    let finishSave!: () => void;
    let pending = true;
    const flush = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finishSave = () => {
            pending = false;
            resolve(true);
          };
        }),
    );
    unregisterSaves.push(
      registerEditorSave('post:one', {
        hasPending: () => pending,
        flush,
      }),
    );
    render(
      <NavigationLink href="/next" replace scroll={false}>
        Next
      </NavigationLink>,
    );

    const preventDefault = vi.fn();
    navigate({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(flush).toHaveBeenCalledOnce();
    expect(mocks.replace).not.toHaveBeenCalled();

    await act(async () => {
      finishSave();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('http://localhost:3000/next', { scroll: false });
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('does not leave after a save failure and reports the shared failure message', async () => {
    const pending = true;
    unregisterSaves.push(
      registerEditorSave('page:one', {
        hasPending: () => pending,
        flush: vi.fn(async () => false),
      }),
    );
    render(<NavigationLink href="/next">Next</NavigationLink>);

    const preventDefault = vi.fn();
    navigate({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(host.querySelector('a')?.textContent).toBe('Next');
    expect(notifications.show).toHaveBeenCalledExactlyOnceWith({
      message: 'common.notifications.saveFailed',
      color: 'red',
    });
  });

  it('flushes a newer draft registered while an earlier acknowledgement is pending', async () => {
    let version = 1;
    let acknowledgedVersion = 0;
    let finishFirstFlush!: () => void;
    const flush = vi.fn(async () => {
      const flushingVersion = version;
      if (flushingVersion === 1) {
        await new Promise<void>((resolve) => {
          finishFirstFlush = resolve;
        });
      }
      acknowledgedVersion = flushingVersion;
      return true;
    });
    unregisterSaves.push(
      registerEditorSave('post:two', {
        hasPending: () => acknowledgedVersion < version,
        flush,
      }),
    );
    render(<NavigationLink href="/after-save">After save</NavigationLink>);

    const preventDefault = vi.fn();
    navigate({ preventDefault });
    expect(flush).toHaveBeenCalledOnce();
    expect(mocks.push).not.toHaveBeenCalled();

    version = 2;
    await act(async () => {
      finishFirstFlush();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(flush).toHaveBeenCalledTimes(2);
    expect(acknowledgedVersion).toBe(2);
    expect(mocks.push).toHaveBeenCalledExactlyOnceWith('http://localhost:3000/after-save', { scroll: undefined });
  });
});
