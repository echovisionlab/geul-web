// @vitest-environment jsdom

import { act, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@mantine/notifications', () => ({ notifications: { show: mocks.notification } }));
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
  TextButton: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/components/core/MediaPreviewGrid', () => ({ MediaPreviewGrid: () => null }));
vi.mock('@/components/core/Section', () => ({
  SectionCard: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}));
vi.mock('@/components/core/Tooltip', () => ({ Tooltip: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/features/editor/EditorHeader', () => ({
  createDraftPublishedStatusOptions: () => [],
  EditorHeader: (props: { controls?: ReactNode; isConnected: boolean; isSynced: boolean }) => {
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
  updateSeriesAction: vi.fn(),
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

function renderedPostTitles() {
  return Array.from(container.querySelectorAll('tbody tr')).map(
    (row) => row.querySelectorAll('td')[1]?.textContent ?? '',
  );
}

describe('SeriesDetail post ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('optimistically reorders and restores the authoritative order when persistence fails', async () => {
    let resolveReorder: ((result: { error: 'series_unavailable' }) => void) | undefined;
    mocks.reorder.mockReturnValue(
      new Promise((resolve) => {
        resolveReorder = resolve;
      }),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MantineProvider env="test">
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
          </MantineProvider>
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

    const firstRow = Array.from(container.querySelectorAll('tbody tr')).find((row) =>
      row.textContent?.includes('First post'),
    );
    act(() => firstRow?.querySelector<HTMLButtonElement>('[aria-label="posts.actions.moveDown"]')?.click());
    await vi.waitFor(() => expect(renderedPostTitles()).toEqual(['Second post/second', 'First post/first']));

    await act(async () => resolveReorder?.({ error: 'series_unavailable' }));

    await vi.waitFor(() => expect(renderedPostTitles()).toEqual(['First post/first', 'Second post/second']));
    expect(mocks.notification).toHaveBeenCalledWith({
      message: 'notifications.accessChanged',
      color: 'red',
    });
  });

  it('keeps Manager source editing enabled without admin translation generation controls', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MantineProvider env="test">
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
          </MantineProvider>
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
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
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
          <MantineProvider env="test">
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
          </MantineProvider>
        </QueryClientProvider>,
      );
    });

    const targetHeader = mocks.editorHeader.mock.calls.at(-1)?.[0] as {
      title: string;
      titleDisabled: boolean;
      onTitleChange: (value: string) => void;
    };
    expect(targetHeader).toMatchObject({ title: '협업 제목', titleDisabled: false });
    act(() => targetHeader.onTitleChange('수정 제목'));
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
          <MantineProvider env="test">
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
          </MantineProvider>
        </QueryClientProvider>,
      );
    });
    expect(mocks.editorHeader.mock.calls.at(-1)?.[0]).toMatchObject({
      title: 'Source title',
      titleDisabled: true,
    });
  });
});
