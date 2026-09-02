// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VersionContributor, VersionInfo } from '@/lib/types/version-history';
import type { VersionHistoryDrawerViewProps } from './ui/VersionHistoryDrawerView';
import { formatVersionContributors, VersionHistoryDrawer } from './VersionHistoryDrawer';

const {
  getViewProps,
  listVersionsRequestMock,
  notificationShowMock,
  queryInvalidateMock,
  restoreVersionRequestMock,
  routerRefreshMock,
  setViewProps,
} = vi.hoisted(() => {
  let viewProps: unknown = null;

  return {
    getViewProps: () => viewProps,
    listVersionsRequestMock: vi.fn(),
    notificationShowMock: vi.fn(),
    queryInvalidateMock: vi.fn(),
    restoreVersionRequestMock: vi.fn(),
    routerRefreshMock: vi.fn(),
    setViewProps: (value: unknown) => {
      viewProps = value;
    },
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: routerRefreshMock }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: queryInvalidateMock }),
}));

vi.mock('./ui/VersionHistoryDrawerView', () => ({
  VersionHistoryDrawerView: (props: unknown) => {
    setViewProps(props);
    return <div data-testid="version-history-view" />;
  },
}));

vi.mock('@/lib/client/version-history', () => ({
  listVersionsRequest: listVersionsRequestMock,
  restoreVersionRequest: restoreVersionRequestMock,
}));

vi.mock('@mantine/notifications', () => ({
  notifications: { show: notificationShowMock },
}));

vi.mock('@/lib/providers/LocaleProvider', () => ({
  useLocale: () => 'en',
}));

vi.mock('@/features/date-time/DateTime', () => ({
  useDateTimeFormatter: () => ({
    dateTime: (createdAt: string) => `absolute:${createdAt}:en`,
    timeZone: 'UTC',
  }),
}));

vi.mock('@/lib/utils/formatDate', () => ({
  formatRelativeTime: (createdAt: string, locale: string) => `relative:${createdAt}:${locale}`,
}));

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, string | number>) => {
    if (namespace === 'versionHistory' && key === 'by') {
      return `by ${values?.contributors}`;
    }
    if (namespace === 'versionHistory' && key === 'systemOrLegacy') {
      return 'System or earlier version';
    }
    if (namespace === 'versionHistory' && key === 'restoreSameLocaleBody') {
      return `Same-locale restore v${values?.version} (${values?.locale}) stales translations without regeneration.`;
    }
    if (namespace === 'versionHistory' && key === 'restoreCrossLocaleBody') {
      return `Cross-locale restore v${values?.version}: ${values?.currentLocale} to ${values?.selectedLocale} deletes targets without fan-out.`;
    }
    if (namespace === 'versionHistory' && key === 'restored') {
      return `Restored v${values?.version}`;
    }
    if (namespace === 'versionHistory' && key === 'restoreFailed') {
      return 'Failed to restore source document';
    }
    return `${namespace}.${key}`;
  },
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

let container: HTMLDivElement;
let root: Root;

function currentViewProps() {
  const props = getViewProps();
  if (!props) {
    throw new Error('Expected VersionHistoryDrawerView props.');
  }
  return props as VersionHistoryDrawerViewProps;
}

function renderController(
  opened: boolean,
  callbacks: { onClose: () => void; onRestored: () => void },
  canRestore = true,
  entityType: 'post' | 'page' | 'work' = 'work',
) {
  root.render(
    <VersionHistoryDrawer
      entityType={entityType}
      entityId={`${entityType}-1`}
      opened={opened}
      onClose={callbacks.onClose}
      currentSourceLocale="en"
      canRestore={canRestore}
      onRestored={callbacks.onRestored}
    />,
  );
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  setViewProps(null);
  listVersionsRequestMock.mockResolvedValue({ versions });
  restoreVersionRequestMock.mockResolvedValue({ success: true });
  queryInvalidateMock.mockResolvedValue(undefined);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  setViewProps(null);
  vi.clearAllMocks();
});

describe('VersionHistoryDrawer controller', () => {
  it('fetches on open and maps service versions to serializable view models', async () => {
    const callbacks = { onClose: vi.fn(), onRestored: vi.fn() };

    act(() => renderController(false, callbacks));
    expect(listVersionsRequestMock).not.toHaveBeenCalled();

    await act(async () => renderController(true, callbacks));

    expect(listVersionsRequestMock).toHaveBeenCalledWith('work', 'work-1');
    expect(currentViewProps().versions).toEqual([
      {
        id: 'version-2',
        version: 2,
        versionLabel: 'v2',
        title: 'common.states.untitledPlain',
        sourceLocaleLabel: 'common.labels.locale: en',
        createdAtLabel: 'relative:2026-07-20T01:00:00.000Z:en',
        createdAtTooltip: 'absolute:2026-07-20T01:00:00.000Z:en',
        contributorLabel: 'by Mina and Jules',
      },
    ]);
    expect(currentViewProps().loading).toBe(false);
  });

  it('never exposes a Member UUID when malformed contributor data lacks a nickname', () => {
    const malformed = [{ memberId: 'member-secret-id' }] as unknown as VersionContributor[];
    expect(formatVersionContributors(malformed, 'en')).toBeNull();
  });

  it('uses a neutral label when a version has no recorded contributors', async () => {
    listVersionsRequestMock.mockResolvedValue({
      versions: [{ ...versions[0], contributors: [] }],
    });

    await act(async () => renderController(true, { onClose: vi.fn(), onRestored: vi.fn() }));

    expect(currentViewProps().versions[0]?.contributorLabel).toBe('System or earlier version');
  });

  it('restores the selected service version, closes both surfaces, and reports completion', async () => {
    const callbacks = { onClose: vi.fn(), onRestored: vi.fn() };
    await act(async () => renderController(true, callbacks));

    act(() => currentViewProps().onSelectVersion('version-2'));
    expect(currentViewProps().selectedVersionId).toBe('version-2');
    expect(currentViewProps().restoreConfirmationOpened).toBe(true);
    expect(currentViewProps().labels.restoreBody).toBe(
      'Same-locale restore v2 (en) stales translations without regeneration.',
    );

    await act(async () => currentViewProps().onRestore());

    expect(restoreVersionRequestMock).toHaveBeenCalledWith('work', 'work-1', 'version-2');
    expect(notificationShowMock).toHaveBeenCalledWith({
      message: 'Restored v2',
      color: 'green',
    });
    expect(currentViewProps().restoreConfirmationOpened).toBe(false);
    expect(callbacks.onClose).toHaveBeenCalledOnce();
    expect(callbacks.onRestored).toHaveBeenCalledOnce();
    expect(queryInvalidateMock).toHaveBeenCalledWith({ queryKey: ['entity-translations', 'work', 'work-1'] });
    expect(queryInvalidateMock).toHaveBeenCalledWith({ queryKey: ['entity-translation-jobs', 'work', 'work-1'] });
    expect(routerRefreshMock).toHaveBeenCalledOnce();
  });

  it.each(['post', 'page', 'work'] as const)(
    'uses the same-locale source-only restore warning for %s',
    async (entityType) => {
      await act(async () => renderController(true, { onClose: vi.fn(), onRestored: vi.fn() }, true, entityType));

      act(() => currentViewProps().onSelectVersion('version-2'));
      expect(currentViewProps().labels.restoreBody).toBe(
        'Same-locale restore v2 (en) stales translations without regeneration.',
      );
    },
  );

  it('uses the destructive source-locale switch warning for a cross-locale snapshot', async () => {
    listVersionsRequestMock.mockResolvedValue({
      versions: [{ ...versions[0], sourceLocale: 'ko' }],
    });
    await act(async () => renderController(true, { onClose: vi.fn(), onRestored: vi.fn() }));

    act(() => currentViewProps().onSelectVersion('version-2'));

    expect(currentViewProps().labels.restoreBody).toBe(
      'Cross-locale restore v2: en to ko deletes targets without fan-out.',
    );
  });

  it('keeps the restore flow open and reports service errors', async () => {
    const callbacks = { onClose: vi.fn(), onRestored: vi.fn() };
    restoreVersionRequestMock.mockResolvedValue({ error: 'raw provider secret: abc123' });
    await act(async () => renderController(true, callbacks));
    act(() => currentViewProps().onSelectVersion('version-2'));

    await act(async () => currentViewProps().onRestore());

    expect(notificationShowMock).toHaveBeenCalledWith({ message: 'Failed to restore source document', color: 'red' });
    expect(currentViewProps().restoreConfirmationOpened).toBe(true);
    expect(callbacks.onClose).not.toHaveBeenCalled();
    expect(callbacks.onRestored).not.toHaveBeenCalled();
    expect(queryInvalidateMock).not.toHaveBeenCalled();
    expect(routerRefreshMock).not.toHaveBeenCalled();
  });

  it('keeps the drawer and confirmation open when the restore request rejects', async () => {
    restoreVersionRequestMock.mockRejectedValue(new Error('upstream provider secret'));
    const callbacks = { onClose: vi.fn(), onRestored: vi.fn() };
    await act(async () => renderController(true, callbacks));
    act(() => currentViewProps().onSelectVersion('version-2'));

    await act(async () => currentViewProps().onRestore());

    expect(notificationShowMock).toHaveBeenCalledWith({ message: 'Failed to restore source document', color: 'red' });
    expect(currentViewProps().restoreConfirmationOpened).toBe(true);
    expect(callbacks.onClose).not.toHaveBeenCalled();
  });

  it('keeps version history readable but rejects restore intent while locked', async () => {
    const callbacks = { onClose: vi.fn(), onRestored: vi.fn() };
    await act(async () => renderController(true, callbacks, false));

    expect(currentViewProps().versions).toHaveLength(1);
    expect(currentViewProps().canRestore).toBe(false);
    act(() => currentViewProps().onSelectVersion('version-2'));
    await act(async () => currentViewProps().onRestore());

    expect(currentViewProps().selectedVersionId).toBeNull();
    expect(currentViewProps().restoreConfirmationOpened).toBe(false);
    expect(restoreVersionRequestMock).not.toHaveBeenCalled();
  });
});
