// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NavigationLink } from '@/components/core/Navigation';
import {
  registerEditorSave,
  notifyEditorSaveStateChanged,
  announceRestoredEditorEdits,
} from '@/lib/editor/editor-save-registry';
import { notifications } from '@/components/core/Notification';
import { EditorNavigationProvider } from './EditorNavigationProvider';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => `common.notifications.${key}` }));
vi.mock('@/components/core/Notification', () => ({ notifications: { show: mocks.show, hide: mocks.hide } }));
const confirmMocks = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock('@/components/core/Modal/confirm-dialogs', () => ({ confirmDialogs: { open: confirmMocks.open } }));
let host: HTMLDivElement;
let root: Root;
const unregisterSaves: Array<() => void> = [];

beforeEach(() => {
  mocks.push.mockReset();
  mocks.replace.mockReset();
  mocks.show.mockReset().mockReturnValue('notice');
  mocks.hide.mockReset();
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
  const native = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  const preventBrowserNavigation = native.preventDefault.bind(native);
  native.preventDefault = () => {
    event.preventDefault();
    preventBrowserNavigation();
  };
  // Prevent jsdom navigation only after the actual Core navigation guard has run.
  host.addEventListener('click', preventBrowserNavigation, { once: true });
  act(() => host.querySelector('a')!.dispatchEvent(native));
}

describe('EditorNavigationProvider', () => {
  it('announces the first failure once, keeps unload protection, and clears the notice on recovery', () => {
    let failed = false;
    let pending = true;
    unregisterSaves.push(
      registerEditorSave('post:notice', {
        flush: async () => false,
        hasPending: () => pending,
        hasFailure: () => failed,
      }),
    );
    render(<span>Editor</span>);
    failed = true;
    act(() => {
      notifyEditorSaveStateChanged('post:notice');
      notifyEditorSaveStateChanged('post:notice');
    });
    expect(mocks.show).toHaveBeenCalledTimes(1);
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    failed = false;
    pending = false;
    act(() => notifyEditorSaveStateChanged('post:notice'));
    expect(mocks.hide).toHaveBeenCalledWith('notice');
    const cleanUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleanUnload);
    expect(cleanUnload.defaultPrevented).toBe(false);
    act(() => announceRestoredEditorEdits());
    expect(mocks.show).toHaveBeenLastCalledWith({ message: 'common.notifications.editsRestored', tone: 'positive' });
  });

  it('asks before leaving refused edits behind, and discards them only when confirmed', async () => {
    const discard = vi.fn();
    let rejected = true;
    unregisterSaves.push(
      registerEditorSave('post:refused', {
        flush: async () => !rejected,
        hasPending: () => false,
        getRejected: () =>
          rejected ? { patch: { slug: 'taken' }, reason: 'AlreadyExists', message: 'taken', rejectedAt: 1 } : null,
        discardRejected: () => {
          discard();
          rejected = false;
        },
      }),
    );
    confirmMocks.open.mockReset();
    render(<NavigationLink href="/outside">Outside editor</NavigationLink>);

    const preventDefault = vi.fn();
    navigate({ preventDefault });
    await vi.waitFor(() => expect(confirmMocks.open).toHaveBeenCalledOnce());
    expect(preventDefault).toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(discard).not.toHaveBeenCalled();

    act(() => confirmMocks.open.mock.calls[0]![0].onConfirm());
    expect(discard).toHaveBeenCalledOnce();
    expect(mocks.push).toHaveBeenCalledOnce();
  });

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
      tone: 'danger',
      autoClose: false,
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

it.each(['permission_revoked', 'session_expired'] as const)(
  'blocks an editor without its own dialog when access ends, keeping pending edits: %s',
  async (reason) => {
    const { endProviderAccess } = await import('@/lib/collab/provider-control-state');
    const provider = {};
    unregisterSaves.push(registerEditorSave('post:access', { hasPending: () => true, flush: async () => false }));
    render(<span>Editor</span>);
    act(() => endProviderAccess(provider, reason));
    const dialog = document.body.querySelector('[role="alertdialog"], [role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('common.notifications.title');
    expect(mocks.show).not.toHaveBeenCalled();
    const { hasPendingEditorSaves } = await import('@/lib/editor/editor-save-registry');
    expect(hasPendingEditorSaves('post:access')).toBe(true);
  },
);

it('leaves the access-ended dialog to an editor that renders its own', async () => {
  const { claimProviderInterruptionHandling, endProviderAccess } = await import('@/lib/collab/provider-control-state');
  const provider = {};
  const release = claimProviderInterruptionHandling(provider);
  render(<span>Editor</span>);
  act(() => endProviderAccess(provider, 'session_expired'));
  expect(document.body.querySelector('[role="alertdialog"], [role="dialog"]')).toBeNull();
  release();
});

it('keeps a downgraded page open and tells the editor that editing stopped', async () => {
  const { setProviderAccessLevel } = await import('@/lib/collab/provider-control-state');
  render(<span>Editor</span>);
  act(() => setProviderAccessLevel({}, 'view'));
  expect(mocks.show).toHaveBeenCalledWith(expect.objectContaining({ tone: 'warning', autoClose: false }));
  expect(document.body.querySelector('[role="alertdialog"]')).toBeNull();
});

it('does not announce a downgrade for a room opened read-only', async () => {
  const { setProviderAccessLevel } = await import('@/lib/collab/provider-control-state');
  mocks.show.mockClear();
  render(<span>Viewer</span>);
  act(() => setProviderAccessLevel({}, 'view', false));
  expect(mocks.show).not.toHaveBeenCalled();
});

it('refreshes server-rendered permissions in place when an open room is granted edit', async () => {
  const { setProviderAccessLevel } = await import('@/lib/collab/provider-control-state');
  const provider = {};
  render(<span>Editor</span>);
  act(() => setProviderAccessLevel(provider, 'view', false));
  mocks.refresh.mockClear();
  act(() => setProviderAccessLevel(provider, 'edit'));
  expect(mocks.refresh).toHaveBeenCalledOnce();
  expect(mocks.show).toHaveBeenLastCalledWith(expect.objectContaining({ tone: 'positive' }));
});

it('replaces the view-only notice when edit access returns, even if the refresh fails', async () => {
  const { setProviderAccessLevel } = await import('@/lib/collab/provider-control-state');
  const provider = {};
  render(<span>Editor</span>);
  mocks.show.mockReset();
  mocks.show.mockReturnValueOnce('downgrade-notice').mockReturnValueOnce('upgrade-notice');
  mocks.hide.mockClear();
  act(() => setProviderAccessLevel(provider, 'view'));
  mocks.refresh.mockImplementationOnce(() => {
    throw new Error('refresh unavailable');
  });
  act(() => setProviderAccessLevel(provider, 'edit'));
  // The stale view-only notice is closed and the edit notice is shown before refreshing.
  expect(mocks.hide).toHaveBeenCalledWith('downgrade-notice');
  expect(mocks.show).toHaveBeenLastCalledWith(expect.objectContaining({ tone: 'positive' }));
});

it('closes its view-only notice when it unmounts', async () => {
  const { setProviderAccessLevel } = await import('@/lib/collab/provider-control-state');
  render(<span>Editor</span>);
  mocks.show.mockReset();
  mocks.show.mockReturnValueOnce('view-only-notice');
  mocks.hide.mockClear();
  act(() => setProviderAccessLevel({}, 'view'));
  act(() => root.render(<span>Elsewhere</span>));
  expect(mocks.hide).toHaveBeenCalledWith('view-only-notice');
});

it('keeps the view-only notice across re-renders with new message catalogues', async () => {
  const { setProviderAccessLevel } = await import('@/lib/collab/provider-control-state');
  render(<span>Editor</span>);
  mocks.show.mockReset();
  mocks.show.mockReturnValueOnce('view-only-notice');
  mocks.hide.mockClear();
  act(() => setProviderAccessLevel({}, 'view'));
  // The mocked useTranslations returns a new translator on every render, like a catalogue reload.
  render(<span>Editor after reload</span>);
  render(<span>Editor after another reload</span>);
  expect(mocks.hide).not.toHaveBeenCalled();
});
