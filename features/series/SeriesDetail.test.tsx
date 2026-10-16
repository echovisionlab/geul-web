// @vitest-environment jsdom
import { setProviderAccessLevel } from '@/lib/collab/provider-control-state';
import '@testing-library/jest-dom/vitest';

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerEditorSave } from '@/lib/editor/editor-save-registry';
import { SeriesDetail } from './SeriesDetail';

const mocks = vi.hoisted(() => ({
  listPosts: vi.fn(),
  notification: vi.fn(),
  reorder: vi.fn(),
  unassign: vi.fn(),
  useLocaleDocumentSession: vi.fn(),
  usePostSeriesCollaboration: vi.fn(),
  setCollaborationField: vi.fn(),
  editorHeader: vi.fn(),
  routerPush: vi.fn(),
  updateSeries: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.routerPush }) }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/components/core/Notification', () => ({ notifications: { show: mocks.notification } }));
vi.mock('@/components/core/Button', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));
vi.mock('@/components/core/IconButton', () => ({
  IconButton: ({
    children,
    loading: _loading,
    emphasis: _emphasis,
    tone: _tone,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & Record<string, unknown>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));
vi.mock('@/components/core/Input', () => ({ Textarea: () => null, TextInput: () => null }));
vi.mock('@/components/core/TextButton', () => ({
  TextButton: ({ children, href, id }: { children: ReactNode; href: string; id?: string }) => (
    <a id={id} href={href}>
      {children}
    </a>
  ),
}));
vi.mock('@/components/core/MediaPreviewGrid', () => ({ MediaPreviewGrid: () => null }));
vi.mock('@/components/core/Section', () => ({
  SectionCard: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}));
vi.mock('@/components/core/Tooltip', () => ({ Tooltip: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/features/editor/EditorHeader', () => ({
  createDraftPublishedStatusOptions: () => [],
  EditorHeader: (props: {
    controls?: ReactNode;
    isConnected: boolean;
    isSynced: boolean;
    onBack?: () => void | Promise<void>;
    onStatusChange?: (status: 'draft' | 'published') => void | Promise<void>;
  }) => {
    mocks.editorHeader(props);
    return <>{props.controls}</>;
  },
}));
vi.mock('@/features/metadata/OgImagePreview', () => ({ OgImagePreview: () => null }));
vi.mock('@/features/translation/EditorActiveLocaleMenu', () => ({
  EditorActiveLocaleMenu: () => <div data-testid="series-locale-menu" />,
}));
vi.mock('@/features/translation/EntityTranslationsPanel', () => ({
  EntityTranslationsPanel: ({
    entityType,
    canAdministerTranslations,
  }: {
    entityType: string;
    canAdministerTranslations: boolean;
  }) => (
    <div data-testid="series-translations-panel" data-can-administer={String(canAdministerTranslations)}>
      {entityType}
    </div>
  ),
}));
vi.mock('@/features/translation/useLocaleDocumentSession', () => ({
  useLocaleDocumentSession: (...args: unknown[]) => mocks.useLocaleDocumentSession(...args),
}));
vi.mock('@/lib/contexts/EditorRuntimeContext', () => ({
  EditorRuntimeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/features/upload/ImageUploadCropController', () => ({ ImageUploadCropController: () => null }));
vi.mock('@/lib/actions/series', () => ({
  regenerateSeriesOgImageAction: vi.fn(),
  removeSeriesFeaturedImageAction: vi.fn(),
  reorderSeriesPostsAction: mocks.reorder,
  setSeriesFeaturedImageAction: vi.fn(),
  unassignPostFromSeriesAction: mocks.unassign,
  updateSeriesAction: mocks.updateSeries,
}));
vi.mock('@/lib/hooks/useSlugManagement', () => ({
  useSlugManagement: () => ({
    autoMode: false,
    error: null,
    handleChange: vi.fn(),
    isChecking: false,
    toggleAutoMode: vi.fn(),
    updateFromTitle: vi.fn(),
  }),
}));
vi.mock('@/lib/hooks/useUpload', () => ({ useUpload: () => ({ upload: vi.fn(), isUploading: false }) }));
vi.mock('@/lib/queries/series-browser', () => ({ listSeriesPosts: mocks.listPosts }));
vi.mock('./SeriesManagersModal', () => ({ SeriesManagersModal: () => null }));
vi.mock('./useSeriesOgLifecycle', () => ({
  useSeriesOgLifecycle: () => ({
    error: null,
    isRegenerating: false,
    src: null,
    status: null,
    trackAutomaticGenerationRun: vi.fn(),
    trackManualGeneration: vi.fn(),
    trackTitleUpdate: vi.fn(),
  }),
}));
vi.mock('./usePostSeriesCollaboration', () => ({
  usePostSeriesCollaboration: (...args: unknown[]) => mocks.usePostSeriesCollaboration(...args),
}));

const posts = [
  { id: 'post-1', title: 'First post', slug: 'first', status: 'draft' as const, seriesOrder: 0 },
  { id: 'post-2', title: 'Second post', slug: 'second', status: 'draft' as const, seriesOrder: 1 },
];

let container: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;
let unregisterSaves: Array<() => void>;

function renderedPostTitles() {
  return Array.from(container.querySelectorAll('tbody tr')).map(
    (row) => row.querySelectorAll('td')[1]?.textContent ?? '',
  );
}

describe('SeriesDetail post ordering', () => {
  beforeEach(() => {
    notifyManager.setNotifyFunction((callback) => act(callback));
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    vi.clearAllMocks();
    unregisterSaves = [];
    mocks.useLocaleDocumentSession.mockReturnValue({
      activeEditLocale: {
        activeLocale: 'en',
        activeLocaleLabel: 'English',
        canEditActiveLocale: true,
        displaySummary: '',
        displayTitle: 'Series',
        handleSummaryChange: vi.fn(),
        handleTitleChange: vi.fn(),
        hasLiveRow: true,
        isControlVisible: true,
        isLoading: false,
        isSourceLocale: true,
        localeOptions: [],
        ogGenerationRun: null,
        setActiveLocale: vi.fn(),
        sourceLocale: 'en',
      },
      roomLocale: 'en',
    });
    mocks.usePostSeriesCollaboration.mockReturnValue({
      provider: null,
      roomState: { sourceLocale: 'en', locale: 'en', fields: { title: 'Series', summary: '' } },
      isConnected: true,
      isSynced: true,
      setField: mocks.setCollaborationField,
    });
    mocks.listPosts.mockResolvedValue(posts);
    mocks.reorder.mockResolvedValue({ success: true });
    mocks.unassign.mockResolvedValue({ success: true });
    mocks.updateSeries.mockResolvedValue({ success: true });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await queryClient.cancelQueries();
      queryClient.clear();
    });
    notifyManager.setNotifyFunction((callback) => callback());
    for (const unregister of unregisterSaves) {
      unregister();
    }
    container.remove();
  });

  async function renderSeries() {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DesignSystemProvider forceColorScheme="light">
            <SeriesDetail
              scope="admin"
              initialData={{
                series: {
                  id: 'series-1',
                  title: 'Series',
                  slug: 'series',
                  sourceLocale: 'en',
                  status: 'draft',
                },
                managers: [],
              }}
            />
          </DesignSystemProvider>
        </QueryClientProvider>,
      );
    });
    return mocks.editorHeader.mock.calls.at(-1)?.[0] as {
      onBack: () => void | Promise<void>;
      onStatusChange: (status: 'draft' | 'published') => void | Promise<void>;
    };
  }

  function registerPendingSave(document: string, finish: Promise<void>) {
    let pending = true;
    unregisterSaves.push(
      registerEditorSave(document, {
        flush: async () => {
          await finish;
          pending = false;
          return true;
        },
        hasPending: () => pending,
      }),
    );
  }

  it('upgrades and downgrades title, lifecycle and ordering in place', async () => {
    const provider = {};
    setProviderAccessLevel(provider, 'view');
    mocks.usePostSeriesCollaboration.mockReturnValue({ ...mocks.usePostSeriesCollaboration(), provider });
    await renderSeries();
    const panel = container.querySelector('[data-testid="series-translations-panel"]');
    const titleBefore = mocks.editorHeader.mock.lastCall?.[0];
    expect(titleBefore.titleDisabled).toBe(true);
    await act(async () => setProviderAccessLevel(provider, 'edit'));
    expect(mocks.editorHeader.mock.lastCall?.[0].titleDisabled).toBe(false);
    expect(mocks.editorHeader.mock.lastCall?.[0].onStatusChange).toBeTypeOf('function');
    expect(container.querySelector('[data-testid="series-translations-panel"]')).toBe(panel);
    await act(async () => setProviderAccessLevel(provider, 'view'));
    const header = mocks.editorHeader.mock.lastCall?.[0];
    expect(header.titleDisabled).toBe(true);
    expect(header.onStatusChange).toBeUndefined();
    expect(container.querySelector('[data-testid="series-translations-panel"]')).toBe(panel);
    expect(panel?.getAttribute('data-can-administer')).toBe('false');
    expect(
      [...container.querySelectorAll('button[aria-label]')].every((button) => (button as HTMLButtonElement).disabled),
    ).toBe(true);
  });

  it('waits for registered room and slug saves before navigating back', async () => {
    let finishRoom!: () => void;
    let finishSlug!: () => void;
    registerPendingSave(
      'post_series:series-1',
      new Promise<void>((resolve) => {
        finishRoom = resolve;
      }),
    );
    registerPendingSave(
      'post_series:series-1',
      new Promise<void>((resolve) => {
        finishSlug = resolve;
      }),
    );
    const header = await renderSeries();

    let back: Promise<void> | undefined;
    await act(async () => {
      back = Promise.resolve(header.onBack());
      await Promise.resolve();
    });
    expect(mocks.routerPush).not.toHaveBeenCalled();

    await act(async () => finishRoom());
    expect(mocks.routerPush).not.toHaveBeenCalled();
    await act(async () => finishSlug());
    await act(async () => back);
    expect(mocks.routerPush).toHaveBeenCalledWith('/admin/series');
  });

  it('aborts a status transition and reports save failure when a pending save cannot flush', async () => {
    unregisterSaves.push(
      registerEditorSave('post_series:series-1', {
        flush: async () => false,
        hasPending: () => true,
      }),
    );
    const header = await renderSeries();

    await act(async () => {
      await header.onStatusChange('published');
    });

    expect(mocks.updateSeries).not.toHaveBeenCalled();
    expect(mocks.notification).toHaveBeenCalledWith({ message: 'saveFailed', tone: 'danger' });
  });

  it('optimistically reorders and restores the authoritative order when persistence fails', async () => {
    let resolveReorder: ((result: { error: 'series_unavailable' }) => void) | undefined;
    mocks.reorder.mockReturnValue(
      new Promise((resolve) => {
        resolveReorder = resolve;
      }),
    );

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DesignSystemProvider forceColorScheme="light">
            <SeriesDetail
              scope="admin"
              initialData={{
                series: {
                  id: 'series-1',
                  title: 'Series',
                  slug: 'series',
                  sourceLocale: 'en',
                  status: 'draft',
                },
                managers: [],
              }}
            />
          </DesignSystemProvider>
        </QueryClientProvider>,
      );
    });
    await vi.waitFor(() => expect(renderedPostTitles()).toEqual(['First post/first', 'Second post/second']));
    expect(container.querySelector('[data-testid="series-locale-menu"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="series-translations-panel"]')?.textContent).toBe('post_series');
    expect(
      container.querySelector('[data-testid="series-translations-panel"]')?.getAttribute('data-can-administer'),
    ).toBe('true');
    expect(mocks.useLocaleDocumentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'post_series',
      }),
    );
    expect(mocks.usePostSeriesCollaboration).toHaveBeenCalledWith('series-1', 'en');
    expect(mocks.editorHeader).toHaveBeenCalledWith(expect.objectContaining({ isConnected: true, isSynced: true }));

    const table = container.querySelector('table');
    expect(table).toHaveAccessibleName('posts.title');
    expect(
      Array.from(container.querySelectorAll('thead th')).every((cell) => cell.getAttribute('scope') === 'col'),
    ).toBe(true);
    const firstMove = container.querySelector('[aria-label="posts.actions.moveDown"]');
    expect(firstMove).toHaveAccessibleDescription('First post #1');
    const firstRow = Array.from(container.querySelectorAll('tbody tr')).find((row) =>
      row.textContent?.includes('First post'),
    );
    await act(async () => firstRow?.querySelector<HTMLButtonElement>('[aria-label="posts.actions.moveDown"]')?.click());
    await vi.waitFor(() => expect(renderedPostTitles()).toEqual(['Second post/second', 'First post/first']));
    expect(container.querySelector('[role="status"]')).toHaveTextContent('First post: posts.columns.order #2');

    await act(async () => resolveReorder?.({ error: 'series_unavailable' }));

    await vi.waitFor(() => expect(renderedPostTitles()).toEqual(['First post/first', 'Second post/second']));
    expect(mocks.notification).toHaveBeenCalledWith({
      message: 'notifications.accessChanged',
      tone: 'danger',
    });
  });

  it('keeps Manager source editing enabled without admin translation generation controls', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DesignSystemProvider forceColorScheme="light">
            <SeriesDetail
              scope="my"
              initialData={{
                series: {
                  id: 'series-1',
                  title: 'Series',
                  slug: 'series',
                  sourceLocale: 'en',
                  status: 'draft',
                },
                managers: [],
              }}
            />
          </DesignSystemProvider>
        </QueryClientProvider>,
      );
    });

    expect(mocks.useLocaleDocumentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'post_series',
      }),
    );
    expect(
      container.querySelector('[data-testid="series-translations-panel"]')?.getAttribute('data-can-administer'),
    ).toBe('false');
  });

  it('edits an existing target through its exact collaboration room and keeps a missing target read-only', async () => {
    const activeEditLocale = {
      activeLocale: 'ko',
      activeLocaleLabel: '한국어',
      canEditActiveLocale: true,
      displaySummary: 'API 미리보기',
      displayTitle: 'API 미리보기',
      handleSummaryChange: vi.fn(),
      handleTitleChange: vi.fn(),
      hasLiveRow: true,
      isControlVisible: true,
      isLoading: false,
      isSourceLocale: false,
      localeOptions: [],
      ogGenerationRun: null,
      setActiveLocale: vi.fn(),
      sourceLocale: 'en',
    };
    mocks.useLocaleDocumentSession.mockReturnValue({ activeEditLocale, roomLocale: 'ko' });
    mocks.usePostSeriesCollaboration.mockReturnValue({
      provider: null,
      roomState: { sourceLocale: 'en', locale: 'ko', fields: { title: '협업 제목', summary: '' } },
      isConnected: true,
      isSynced: true,
      setField: mocks.setCollaborationField,
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DesignSystemProvider forceColorScheme="light">
            <SeriesDetail
              scope="admin"
              initialData={{
                series: {
                  id: 'series-1',
                  title: 'Series',
                  slug: 'series',
                  sourceLocale: 'en',
                  status: 'draft',
                },
                managers: [],
              }}
            />
          </DesignSystemProvider>
        </QueryClientProvider>,
      );
    });

    const targetHeader = mocks.editorHeader.mock.calls.at(-1)?.[0] as {
      title: string;
      titleDisabled: boolean;
      onTitleChange: (value: string) => void;
    };
    expect(targetHeader).toMatchObject({ title: '협업 제목', titleDisabled: false });
    await act(async () => targetHeader.onTitleChange('수정 제목'));
    expect(mocks.setCollaborationField).toHaveBeenCalledWith('title', '수정 제목');
    expect(
      Array.from(container.querySelectorAll('button')).some((button) => button.textContent === 'saveChanges'),
    ).toBe(false);

    mocks.useLocaleDocumentSession.mockReturnValue({
      activeEditLocale: { ...activeEditLocale, hasLiveRow: false },
      roomLocale: 'en',
    });
    mocks.usePostSeriesCollaboration.mockReturnValue({
      provider: null,
      roomState: { sourceLocale: 'en', locale: 'en', fields: { title: 'Source title' } },
      isConnected: true,
      isSynced: true,
      setField: mocks.setCollaborationField,
    });
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DesignSystemProvider forceColorScheme="light">
            <SeriesDetail
              scope="admin"
              initialData={{
                series: {
                  id: 'series-1',
                  title: 'Series',
                  slug: 'series',
                  sourceLocale: 'en',
                  status: 'draft',
                },
                managers: [],
              }}
            />
          </DesignSystemProvider>
        </QueryClientProvider>,
      );
    });
    expect(mocks.editorHeader.mock.calls.at(-1)?.[0]).toMatchObject({
      title: 'Source title',
      titleDisabled: true,
    });
  });
});
