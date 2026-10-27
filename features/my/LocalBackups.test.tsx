// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DesignSystemTestProvider } from '@/test/TestProviders';
import en from '@/messages/en.json';
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
const other: LocalBackup = { ...entry, id: 'other', tabId: 'closed-other', bytes: 1048576 };
let root: Root;
let host: HTMLDivElement;
async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}
async function click(label: string, scope: ParentNode = host) {
  const button = [...scope.querySelectorAll<HTMLButtonElement>('button')].find(
    (item) => item.textContent?.trim() === label,
  );
  expect(button).toBeDefined();
  await act(async () => {
    button!.click();
  });
  await settle();
}
async function render() {
  await act(async () =>
    root.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
        <DesignSystemTestProvider locale="en" forceColorScheme="light">
          <LocalBackups />
        </DesignSystemTestProvider>
      </NextIntlClientProvider>,
    ),
  );
  await settle();
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.member = 'member';
  mocks.list.mockResolvedValue([entry]);
  mocks.discard.mockResolvedValue(true);
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {} });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('LocalBackups account surface', () => {
  it('summarizes how many backups this device keeps and their approximate size', async () => {
    mocks.list.mockResolvedValue([entry, other]);
    await render();
    expect(host.textContent).toContain('2 unsaved edits · about 1 MB');
    expect(host.querySelector('[role="list"]')).toBeNull();
  });
  it('deletes nothing on cancel and every closed-tab backup after confirmation', async () => {
    mocks.list.mockResolvedValue([entry, other]);
    await render();
    await click('Delete all');
    await click('Cancel', document.body.querySelector('[role="dialog"]')!);
    expect(mocks.discard).not.toHaveBeenCalled();
    await click('Delete all');
    mocks.discard.mockImplementation(async () => {
      mocks.list.mockResolvedValue([]);
      return true;
    });
    await click('Delete all', document.body.querySelector('[role="dialog"]')!);
    expect(mocks.discard.mock.calls.map(([backup]) => backup.id)).toEqual(['record', 'other']);
    expect(host.textContent).toContain('No backups from closed tabs to recover');
  });
  it('keeps a backup whose document another tab reopened meanwhile', async () => {
    mocks.list.mockResolvedValue([entry, other]);
    await render();
    mocks.discard.mockImplementation(async (backup: LocalBackup) => backup.id === 'record');
    await click('Delete all');
    mocks.list.mockResolvedValueOnce([entry, other]).mockResolvedValue([other]);
    await click('Delete all', document.body.querySelector('[role="dialog"]')!);
    expect(host.textContent).toContain('1 unsaved edit · about 1 MB');
  });
  it('removes the member’s rows immediately on sign-out', async () => {
    await render();
    act(() => {
      mocks.member = null;
      mocks.signedOut?.();
    });
    expect(host.textContent).toBe('');
  });
});
