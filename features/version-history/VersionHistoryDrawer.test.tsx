// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within, act, waitFor } from '@/test/render';
import type { VersionContributor, VersionInfo } from '@/lib/types/version-history';
import en from '@/messages/en.json';
import {
  formatVersionContributors,
  VersionHistoryDrawer,
  type VersionHistoryDrawerProps,
} from './VersionHistoryDrawer';

const mocks = vi.hoisted(() => ({ list: vi.fn(), restore: vi.fn(), notify: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock('@/lib/client/version-history', () => ({
  listVersionsRequest: mocks.list,
  restoreVersionRequest: mocks.restore,
}));
vi.mock('@/components/core/Notification', () => ({ notifications: { show: mocks.notify } }));
vi.mock('@/lib/providers/LocaleProvider', () => ({ useLocale: () => 'en' }));
vi.mock('@/features/date-time/DateTime', () => ({
  useDateTimeFormatter: () => ({ dateTime: () => 'July 20, 2026 at 01:00', timeZone: 'UTC' }),
}));
vi.mock('@/lib/utils/formatDate', () => ({ formatRelativeTime: () => '2 minutes ago' }));

const versions: VersionInfo[] = [
  {
    id: 'version-2',
    version: 2,
    title: '',
    sourceLocale: 'en',
    contributors: [
      { memberId: 'user-1', nickname: 'Mina' },
      { memberId: 'user-2', nickname: 'Jules' },
    ],
    createdAt: '2026-07-20T01:00:00.000Z',
  },
];
let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  mocks.list.mockResolvedValue({ versions, total: 1 });
  mocks.restore.mockResolvedValue({ success: true });
});
afterEach(() => {
  client.clear();
});

function renderController(overrides: Partial<VersionHistoryDrawerProps> = {}) {
  const props: VersionHistoryDrawerProps = {
    entityType: 'work',
    entityId: 'work-1',
    opened: true,
    onClose: vi.fn(),
    currentSourceLocale: 'en',
    onRestored: vi.fn(),
    ...overrides,
  };
  const node = (next: VersionHistoryDrawerProps) => (
    <QueryClientProvider client={client}>
      <VersionHistoryDrawer {...next} />
    </QueryClientProvider>
  );
  const view = render(node(props));
  return {
    ...view,
    props,
    rerenderController: (next: Partial<VersionHistoryDrawerProps>) => view.rerender(node({ ...props, ...next })),
  };
}
async function selectVersion(user: ReturnType<typeof render>['user']) {
  const row = await screen.findByRole('listitem', { name: 'Untitled v2' });
  await user.click(within(row).getByRole('button', { name: en.versionHistory.restore }));
  return screen.findByRole('dialog', { name: en.versionHistory.restoreTitle });
}

describe('VersionHistoryDrawer controller', () => {
  it('fetches only on open and renders service version identity, locale, time and contributors', async () => {
    const { rerenderController } = renderController({ opened: false });
    expect(mocks.list).not.toHaveBeenCalled();
    rerenderController({ opened: true });
    const row = await screen.findByRole('listitem', { name: 'Untitled v2' });
    expect(mocks.list).toHaveBeenCalledWith('work', 'work-1', 1, 20, expect.any(AbortSignal));
    expect(row).toHaveTextContent('Locale: EN');
    expect(row).toHaveTextContent('2 minutes ago');
    expect(row).toHaveTextContent('by Mina and Jules');
    expect(within(row).getByText('2 minutes ago')).toHaveAccessibleDescription('July 20, 2026 at 01:00');
  });

  it('does not expose contributor identifiers when a nickname is missing', () => {
    const malformed = [{ memberId: 'member-secret-id' }] as unknown as VersionContributor[];
    expect(formatVersionContributors(malformed, 'en')).toBeNull();
  });

  it('uses the neutral contributor label when no contributors were recorded', async () => {
    mocks.list.mockResolvedValue({ versions: [{ ...versions[0], contributors: [] }], total: 1 });
    renderController();
    expect(await screen.findByText(en.versionHistory.systemOrLegacy)).toBeVisible();
  });

  it('restores the chosen version, invalidates dependent queries and closes both surfaces', async () => {
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { user, props } = renderController();
    const confirmation = await selectVersion(user);
    expect(confirmation).toHaveTextContent(
      en.versionHistory.restoreSameLocaleBody.replace('{version}', '2').replace('{locale}', 'EN'),
    );
    await user.click(within(confirmation).getByRole('button', { name: en.versionHistory.restore }));
    expect(mocks.restore).toHaveBeenCalledWith('work', 'work-1', 'version-2');
    await waitFor(() => expect(props.onClose).toHaveBeenCalledOnce());
    expect(props.onRestored).toHaveBeenCalledOnce();
    for (const key of ['version-history', 'entity-translations', 'entity-translation-jobs']) {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: [key, 'work', 'work-1'] });
    }
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(mocks.notify).toHaveBeenCalledWith({ message: 'Restored to v2', tone: 'positive' });
    expect(screen.queryByRole('dialog', { name: en.versionHistory.restoreTitle })).not.toBeInTheDocument();
  });

  it('names both source locales when restoring a cross-locale snapshot', async () => {
    mocks.list.mockResolvedValue({ versions: [{ ...versions[0], sourceLocale: 'ko' }], total: 1 });
    const { user } = renderController();
    const confirmation = await selectVersion(user);
    expect(confirmation).toHaveTextContent(
      en.versionHistory.restoreCrossLocaleBody
        .replace('{version}', '2')
        .replace('{currentLocale}', 'EN')
        .replace('{selectedLocale}', 'KO'),
    );
  });

  it.each(['error', 'rejection'] as const)('keeps confirmation open and bounds a restore %s', async (kind) => {
    if (kind === 'error') {
      mocks.restore.mockResolvedValue({ error: 'raw provider secret: abc123' });
    } else {
      mocks.restore.mockRejectedValue(new Error('raw provider secret: abc123'));
    }
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { user, props } = renderController();
    const confirmation = await selectVersion(user);
    await user.click(within(confirmation).getByRole('button', { name: en.versionHistory.restore }));
    await waitFor(() =>
      expect(mocks.notify).toHaveBeenCalledWith({ message: en.versionHistory.restoreFailed, tone: 'danger' }),
    );
    expect(confirmation).toBeVisible();
    expect(props.onClose).not.toHaveBeenCalled();
    expect(props.onRestored).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('keeps history readable while restore is locked', async () => {
    const { user } = renderController({ canRestore: false });
    const row = await screen.findByRole('listitem', { name: 'Untitled v2' });
    const restore = within(row).getByRole('button', { name: en.versionHistory.restore });
    expect(restore).toBeDisabled();
    await user.click(restore);
    expect(screen.queryByRole('dialog', { name: en.versionHistory.restoreTitle })).not.toBeInTheDocument();
    expect(mocks.restore).not.toHaveBeenCalled();
  });

  it('appends paginated versions without discarding earlier rows and stops at the end', async () => {
    const first = Array.from({ length: 20 }, (_, index) => ({
      ...versions[0]!,
      id: `version-${41 - index}`,
      version: 41 - index,
    }));
    const second = Array.from({ length: 20 }, (_, index) => ({
      ...versions[0]!,
      id: `version-${21 - index}`,
      version: 21 - index,
    }));
    mocks.list
      .mockResolvedValueOnce({ versions: first, total: 41 })
      .mockResolvedValueOnce({ versions: second, total: 41 })
      .mockResolvedValueOnce({ versions: [{ ...versions[0]!, id: 'version-1', version: 1 }], total: 41 });
    const { user } = renderController();
    expect(await screen.findByRole('listitem', { name: 'Untitled v41' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: en.common.actions.continue }));
    expect(await screen.findByRole('listitem', { name: 'Untitled v2' })).toBeVisible();
    expect(screen.getAllByRole('listitem')).toHaveLength(40);
    expect(screen.getByRole('listitem', { name: 'Untitled v41' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: en.common.actions.continue }));
    expect(await screen.findByRole('listitem', { name: 'Untitled v1' })).toBeVisible();
    expect(screen.getAllByRole('listitem')).toHaveLength(41);
    const continuation = screen.getByRole('button', { name: en.common.actions.continue });
    expect(continuation).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(en.versionHistory.end)).toBeInTheDocument();
    await user.click(continuation);
    expect(mocks.list.mock.calls.map((call) => call[2])).toEqual([1, 2, 3]);
  });

  it('separates initial loading, failure, pending retry and empty results', async () => {
    let finish!: (value: { versions: VersionInfo[]; total: number }) => void;
    mocks.list.mockResolvedValueOnce({ error: 'provider secret' }).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { user } = renderController();
    expect(screen.getByRole('status', { name: en.common.states.loading })).toHaveTextContent(en.common.states.loading);
    expect(await screen.findByRole('alert')).toHaveTextContent(en.versionHistory.loadFailed);
    expect(screen.queryByText(en.versionHistory.empty)).not.toBeInTheDocument();
    const retry = screen.getByRole('button', { name: en.common.actions.tryAgain });
    await user.click(retry);
    expect(retry).toHaveAttribute('aria-busy', 'true');
    await user.click(retry);
    expect(mocks.list).toHaveBeenCalledTimes(2);
    await act(async () => finish({ versions, total: 1 }));
    expect(await screen.findByRole('listitem', { name: 'Untitled v2' })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it.each(['entity', 'close', 'unmount'] as const)(
    'ignores a restore response after %s replacement',
    async (replacement) => {
      let finish!: (value: { success: boolean }) => void;
      mocks.restore.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      const { user, props, unmount, rerenderController } = renderController();
      const confirmation = await selectVersion(user);
      const restore = within(confirmation).getByRole('button', { name: en.versionHistory.restore });
      await user.click(restore);
      expect(restore).toHaveAttribute('aria-busy', 'true');
      await user.click(restore);
      expect(mocks.restore).toHaveBeenCalledOnce();
      if (replacement === 'unmount') {
        unmount();
      } else {
        rerenderController(replacement === 'entity' ? { entityId: 'work-2' } : { opened: false });
      }
      await act(async () => finish({ success: true }));
      expect(props.onRestored).not.toHaveBeenCalled();
      expect(props.onClose).not.toHaveBeenCalled();
      expect(mocks.refresh).not.toHaveBeenCalled();
      expect(mocks.notify).not.toHaveBeenCalled();
      if (replacement === 'entity') {
        expect(screen.queryByRole('dialog', { name: en.versionHistory.restoreTitle })).not.toBeInTheDocument();
        expect(await screen.findByRole('listitem', { name: 'Untitled v2' })).toBeVisible();
      }
    },
  );
});
