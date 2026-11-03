// @vitest-environment jsdom
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@/test/render';
import { LocalBackups } from './LocalBackups';
import type { LocalBackup } from '@/lib/collab/local-backups';
const mocks = vi.hoisted(() => ({
  member: 'member' as string | null,
  list: vi.fn(),
  discard: vi.fn(),
  signedOut: null as (() => void) | null,
}));
vi.mock('@/lib/providers/SessionProvider', () => ({ useSessionContext: () => ({ data: { user: { id: 'member' } } }) }));
vi.mock('@/lib/auth/active-member', () => ({
  getActiveMember: () => mocks.member,
  subscribeSignedOutMembers: (listener: () => void) => {
    mocks.signedOut = listener;
    return () => {
      mocks.signedOut = null;
    };
  },
}));
vi.mock('@/lib/collab/local-backups', () => ({
  createBrowserLocalBackupRepository: () => ({ list: mocks.list, discard: mocks.discard }),
}));
const entry: LocalBackup = {
  database: 'geul-block-room-journal',
  id: 'record',
  tabId: 'closed-tab',
  documentKind: 'post',
  entityId: '11111111-1111-4111-8111-111111111111',
  locale: 'ko',
  updatedAt: Date.parse('2026-10-14T02:00:00Z'),
  bytes: 1536,
};
const other = { ...entry, id: 'other', tabId: 'closed-other', bytes: 1048576 };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.member = 'member';
  mocks.list.mockResolvedValue([entry]);
  mocks.discard.mockResolvedValue(true);
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {} });
});
describe('LocalBackups account surface', () => {
  it('summarizes device backups without listing private document names', async () => {
    mocks.list.mockResolvedValue([entry, other]);
    render(<LocalBackups />);
    expect(await screen.findByText('2 unsaved edits · about 1 MB')).toBeVisible();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
  it('deletes nothing on cancel and every closed-tab backup after confirmation', async () => {
    mocks.list.mockResolvedValue([entry, other]);
    const { user } = render(<LocalBackups />);
    await user.click(await screen.findByRole('button', { name: 'Delete all' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(mocks.discard).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Delete all' }));
    mocks.discard.mockImplementation(async () => {
      mocks.list.mockResolvedValue([]);
      return true;
    });
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete all' }));
    expect(await screen.findByText('No backups from closed tabs to recover.')).toBeVisible();
    expect(mocks.discard.mock.calls.map(([backup]) => backup.id)).toEqual(['record', 'other']);
  });
  it('keeps a backup whose document another tab reopened meanwhile', async () => {
    mocks.list.mockResolvedValue([entry, other]);
    const { user } = render(<LocalBackups />);
    await user.click(await screen.findByRole('button', { name: 'Delete all' }));
    mocks.list.mockResolvedValueOnce([entry, other]).mockResolvedValue([other]);
    mocks.discard.mockImplementation(async (backup: LocalBackup) => backup.id === 'record');
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete all' }));
    expect(await screen.findByText('1 unsaved edit · about 1 MB')).toBeVisible();
  });
  it('shows a shared initial wait without a false empty result', async () => {
    let finish!: (entries: LocalBackup[]) => void;
    mocks.list.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<LocalBackups />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(screen.queryByText('No backups from closed tabs to recover.')).not.toBeInTheDocument();
    await act(async () => finish([]));
    expect(await screen.findByText('No backups from closed tabs to recover.')).toBeVisible();
  });
  it('removes the member’s rows immediately on sign-out', async () => {
    render(<LocalBackups />);
    await screen.findByText('1 unsaved edit · about 1.5 kB');
    act(() => {
      mocks.member = null;
      mocks.signedOut?.();
    });
    expect(screen.queryByText(/unsaved edit/)).not.toBeInTheDocument();
  });
});

it('stops an old member’s bulk clear after sign-out without starting another refresh', async () => {
  let finish!: (discarded: boolean) => void;
  mocks.list.mockResolvedValue([entry, other]);
  mocks.discard.mockImplementationOnce(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
  );
  const { user } = render(<LocalBackups />);
  await user.click(await screen.findByRole('button', { name: 'Delete all' }));
  await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete all' }));
  act(() => {
    mocks.member = null;
    mocks.signedOut?.();
  });
  await act(async () => finish(true));
  expect(mocks.discard).toHaveBeenCalledTimes(1);
  expect(mocks.list).toHaveBeenCalledTimes(2);
  expect(screen.queryByText(/unsaved edit/)).not.toBeInTheDocument();
});
