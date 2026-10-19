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
  push: vi.fn(),
  signedOut: null as (() => void) | null,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
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
};
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
  it('shows kind, locale and last change, then opens the exact editor without adopting the journal', async () => {
    await render();
    expect(host.textContent).toContain('Post');
    expect(host.textContent).toContain('KO');
    expect(host.textContent).toContain('Last changed');
    await click('Open editor');
    expect(mocks.push).toHaveBeenCalledWith(`/posts/${entry.entityId}?lang=ko&edit=true`);
    expect(mocks.discard).not.toHaveBeenCalled();
  });
  it('keeps the record on cancel and deletes only after discard confirmation', async () => {
    await render();
    await click('Discard');
    expect(mocks.discard).not.toHaveBeenCalled();
    await click('Cancel', document.body.querySelector('[role="dialog"]')!);
    expect(mocks.discard).not.toHaveBeenCalled();
    await click('Discard');
    mocks.discard.mockImplementation(async () => {
      mocks.list.mockResolvedValue([]);
      return true;
    });
    await click('Discard', document.body.querySelector('[role="dialog"]')!);
    expect(mocks.discard).toHaveBeenCalledExactlyOnceWith(entry);
    expect(host.textContent).toContain('No backups from closed tabs to recover');
  });
  it('refreshes instead of opening a stale row claimed by a live tab', async () => {
    await render();
    mocks.list.mockResolvedValue([]);
    await click('Open editor');
    expect(mocks.push).not.toHaveBeenCalled();
    expect(host.textContent).toContain('No backups from closed tabs to recover');
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
