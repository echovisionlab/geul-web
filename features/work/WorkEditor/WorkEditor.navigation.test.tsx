// @vitest-environment jsdom
import { setProviderAccessLevel } from '@/lib/collab/provider-control-state';

import type { ComponentProps } from 'react';
import { act, render, screen } from '@/test/render';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  onBack: null as null | (() => void | Promise<void>),
  onStatusChange: null as null | ((status: string) => void | Promise<void>),
  onDelete: null as null | (() => void | Promise<void>),
  onTitleChange: null as null | ((value: string) => void),
  updateFromTitle: vi.fn(),
  debouncedPatch: vi.fn(),
  routerBack: vi.fn(),
  notification: vi.fn(),
  lifecycleChangeStatus: vi.fn(),
  lifecycleDelete: vi.fn(),
  meta: null as null | Record<string, unknown>,
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ back: mocks.routerBack, refresh: vi.fn() }) }));
vi.mock('next-intl', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next-intl')>()),
  useTranslations: () => Object.assign((key: string) => key, { rich: (key: string) => key }),
}));
vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
}));
vi.mock('@/components/core/Notification', () => ({ notifications: { show: mocks.notification } }));

vi.mock('@tabler/icons-react', () => ({ IconHistory: () => null }));
vi.mock('@/features/editor/EditorHeader', () => ({
  EditorHeader: ({
    titleDisabled,
    onBack,
    onStatusChange,
    onDelete,
    onTitleChange,
  }: {
    titleDisabled?: boolean;
    onBack?: () => void | Promise<void>;
    onStatusChange?: (status: string) => void | Promise<void>;
    onDelete?: () => void | Promise<void>;
    onTitleChange?: (value: string) => void;
  }) => {
    mocks.onBack = onBack ?? null;
    mocks.onTitleChange = onTitleChange ?? null;
    mocks.onStatusChange = onStatusChange ?? null;
    mocks.onDelete = onDelete ?? null;
    return <header data-testid="work-header" data-readonly={String(titleDisabled)} />;
  },
}));
vi.mock('@/features/metadata/OgImagePreview', () => ({ OgImagePreview: () => null }));
vi.mock('@/features/site/PageLoader', () => ({ PageLoader: () => null }));
vi.mock('@/features/share/ShareLinkSection', () => ({ ShareLinkSection: () => null }));
vi.mock('@/features/metadata/UrlSection', () => ({ UrlSection: () => null }));
vi.mock('@/features/version-history', () => ({ VersionHistoryDrawer: () => null }));
vi.mock('@/features/metadata/MetadataPanel/MetadataPanel', () => ({ MetadataPanel: () => null }));
vi.mock('@/features/metadata/SummaryFieldCard/SummaryFieldCard', () => ({ SummaryFieldCard: () => null }));
vi.mock('@/features/place/CreatePlaceModal', () => ({ CreatePlaceModal: () => null }));
vi.mock('@/features/post/PostEditor/LocationSelector', () => ({ LocationSelector: () => null }));
vi.mock('@/features/translation/EditorActiveLocaleControl', () => ({ EditorActiveLocaleControl: () => null }));
vi.mock('@/features/translation/EntityTranslationsPanel', () => ({ EntityTranslationsPanel: () => null }));
vi.mock('@/features/translation/LocalizedRichTextFragmentEditor', () => ({
  LocalizedRichTextFragmentEditor: () => null,
}));
vi.mock('@/features/editor/hooks/useBlockRoomTiptapController', () => ({
  useRichTextBlockRoomController: () => null,
}));
vi.mock('@/lib/api/map-place-browser-client', () => ({
  createMapPlaceForBlockWithBrowserClient: vi.fn(),
  createMapPlaceWithBrowserClient: vi.fn(),
}));
vi.mock('@/lib/contexts/EditorRuntimeContext', () => ({
  EditorRuntimeProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/contexts/MapPlaceActionContext', () => ({
  MapPlaceActionProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/contexts/WorkMetaContext', () => ({
  WorkMetaProvider: ({ children }: { children: unknown }) => children,
  useWorkMeta: () => mocks.meta,
}));
vi.mock('@/lib/hooks/useOgImage', () => ({
  useOgImage: () => ({
    src: null,
    isRegenerating: false,
    status: null,
    error: null,
    targetKey: 'target',
    trackLatest: vi.fn(),
    trackRequestedGeneration: vi.fn(),
  }),
}));
vi.mock('@/lib/hooks/useOgGenerationLookupSignal', () => ({ useOgGenerationLookupSignal: vi.fn() }));
vi.mock('@/lib/hooks/useSlugManagement', () => ({
  useSlugManagement: () => ({
    error: null,
    isChecking: false,
    handleChange: vi.fn(),
    handleBlur: vi.fn(),
    updateFromTitle: mocks.updateFromTitle,
  }),
}));
vi.mock('@/lib/collab/block-room-metadata', () => ({ updateBlockRoomLocaleMetadata: vi.fn() }));
vi.mock('@/lib/editor/editor-entity-changes', () => ({
  publishEditorEntityChange: vi.fn(),
  useEditorEntityChanges: vi.fn(),
}));
vi.mock('@/lib/editor/useBlockRoomMetadataUpdates', () => ({ useBlockRoomMetadataUpdates: vi.fn() }));
vi.mock('@/lib/editor/useDebouncedPatch', () => ({ useDebouncedPatch: () => mocks.debouncedPatch }));
vi.mock('@/lib/editor/useDebouncedRoomMetadata', () => ({ useDebouncedRoomMetadata: () => vi.fn() }));
vi.mock('@/features/work/WorkEditor/WorkCreditsSection', () => ({ WorkCreditsSection: () => null }));
vi.mock('@/features/work/WorkEditor/WorkClientsSection', () => ({ WorkClientsSection: () => null }));
vi.mock('@/features/work/WorkEditor/WorkFeaturedImageUploader', () => ({ WorkFeaturedImageUploader: () => null }));
vi.mock('@/features/work/WorkEditor/WorkMetaForm', () => ({ WorkMetaForm: () => null }));
vi.mock('@/features/work/WorkEditor/useWorkLifecycle', () => ({
  useWorkLifecycle: ({ canEdit }: { canEdit: boolean }) => ({
    status: 'draft',
    canEdit,
    controls: { statusOptions: [], canDelete: true },
    changeStatus: mocks.lifecycleChangeStatus,
    deleteWork: { mutate: mocks.lifecycleDelete, isPending: false },
    isChanging: false,
  }),
}));

import { WorkEditor } from '@/features/work/WorkEditor/WorkEditor';
import { registerEditorSave } from '@/lib/editor/editor-save-registry';

const props = {
  workId: 'work-1',
  currentMemberId: 'member-1',
  initialTitle: 'Work title',
  initialSlug: 'work-title',
  initialType: 'music_project',
  initialYear: 2024,
  initialMonth: 1,
  initialUntilYear: null,
  initialUntilMonth: null,
  initialIsPresent: true,
  initialSummary: 'Summary',
  initialMetadata: {},
  initialFeatured: false,
  initialStatus: 'draft',
  initialMapPlaceId: null,
  initialFeaturedImageUrl: null,
  initialOgImageUrl: null,
  initialClients: [],
  userName: 'Editor',
  isAdmin: true,
  canEdit: true,
  baseUrl: 'https://example.test',
  canonicalOrigin: 'https://example.test',
  siteName: 'Example',
} satisfies ComponentProps<typeof WorkEditor>;

let view: ReturnType<typeof render> | undefined;
let unregisterPendingSave: (() => void) | null;

beforeEach(() => {
  vi.clearAllMocks();
  view = undefined;
  unregisterPendingSave = null;
  mocks.onBack = null;
  mocks.onStatusChange = null;
  mocks.onDelete = null;
  mocks.onTitleChange = null;
  mocks.meta = {
    slug: 'work-title',
    type: 'project',
    year: 2024,
    month: 1,
    untilYear: null,
    untilMonth: null,
    isPresent: true,
    metadata: {},
    featured: false,
    featuredImageUrl: null,
    setTitle: vi.fn(),
    setSlug: vi.fn(),
    setType: vi.fn(),
    setPeriod: vi.fn(),
    setSummary: vi.fn(),
    setMetadata: vi.fn(),
    setFeatured: vi.fn(),
    provider: null,
    doc: null,
    isConnected: true,
    isSynced: true,
    bootstrap: { sourceLocale: 'en', locale: 'en', localeExists: true },
    protocol: null,
    acceptEpochAck: vi.fn(),
    reloadCanonical: vi.fn(),
    roomLocale: 'en',
    localeSession: {
      activeEditLocale: {
        activeLocale: 'en',
        activeLocaleLabel: 'English',
        sourceLocale: 'en',
        displayTitle: 'Work title',
        displaySummary: 'Summary',
        displayOgImageUrl: null,
        hasLiveRow: true,
        isLoading: false,
        isSourceLocale: true,
        canEditActiveLocale: true,
        contentPreviewLoading: false,
        ogGenerationRun: null,
        isControlVisible: true,
        localeOptions: [],
        setActiveLocale: vi.fn(),
      },
      hasRoomMutationAuthority: () => true,
    },
  };
});

afterEach(() => {
  view?.unmount();
  unregisterPendingSave?.();
});

function renderWork(onBack?: () => void, canEdit: boolean = props.canEdit) {
  const editor = <WorkEditor {...props} canEdit={canEdit} onBack={onBack} />;
  if (view) {
    view.rerender(editor);
  } else {
    view = render(editor);
  }
}

describe('WorkEditor navigation save barriers', () => {
  it('upgrades and downgrades the open work without replacing its content', () => {
    const provider = {};
    mocks.meta!.provider = provider;
    setProviderAccessLevel(provider, 'view');
    renderWork(undefined, false);
    const header = screen.getByTestId('work-header');
    expect(mocks.onStatusChange).toBeNull();
    act(() => setProviderAccessLevel(provider, 'edit'));
    expect(mocks.onStatusChange).toBeNull();
    renderWork(undefined, true);
    expect(header?.getAttribute('data-readonly')).toBe('false');
    expect(screen.getByTestId('work-header')).toBe(header);
    expect(mocks.onStatusChange).toBeTypeOf('function');
    act(() => setProviderAccessLevel(provider, 'view'));
    expect(mocks.onStatusChange).toBeNull();
    expect(mocks.onDelete).toBeNull();
    expect(header?.getAttribute('data-readonly')).toBe('true');
    expect(screen.getByTestId('work-header')).toBe(header);
  });
  it('routes title edits through the shared slug hook instead of writing the slug directly', () => {
    renderWork();
    expect(mocks.onTitleChange).toBeTypeOf('function');

    act(() => mocks.onTitleChange?.('Renamed work'));

    expect(mocks.updateFromTitle).toHaveBeenCalledWith('Renamed work');
    expect(mocks.meta!.setSlug).not.toHaveBeenCalled();
    expect(mocks.debouncedPatch).not.toHaveBeenCalledWith(expect.objectContaining({ slug: expect.anything() }));
  });

  it('waits for registered Work saves before navigating back', async () => {
    let resolveFlush: ((result: boolean) => void) | undefined;
    let pending = true;
    unregisterPendingSave = registerEditorSave('work:work-1', {
      flush: () => new Promise((resolve) => (resolveFlush = resolve)),
      hasPending: () => pending,
      getPendingPatch: () => ({ summary: 'Pending summary' }),
    });
    const onBack = vi.fn();
    renderWork(onBack);

    let navigation: Promise<void> | undefined;
    act(() => {
      navigation = Promise.resolve(mocks.onBack?.());
    });
    expect(onBack).not.toHaveBeenCalled();

    await act(async () => {
      pending = false;
      resolveFlush?.(true);
      await navigation;
    });
    expect(onBack).toHaveBeenCalledOnce();
  });
  it('blocks navigation, status and deletion on failed saves and allows them after saving succeeds', async () => {
    let saved = false;
    unregisterPendingSave = registerEditorSave('work:work-1', {
      flush: async () => saved,
      hasPending: () => !saved,
      getPendingPatch: () => ({ metadata: { local: true } }),
    });
    const onBack = vi.fn();
    renderWork(onBack);
    expect(mocks.onStatusChange).toBeTypeOf('function');
    expect(mocks.onDelete).toBeTypeOf('function');

    await act(async () => {
      await mocks.onBack?.();
      await mocks.onStatusChange?.('published');
      await mocks.onDelete?.();
    });

    expect(onBack).not.toHaveBeenCalled();
    expect(mocks.lifecycleChangeStatus).not.toHaveBeenCalled();
    expect(mocks.lifecycleDelete).not.toHaveBeenCalled();
    expect(mocks.notification).toHaveBeenCalledTimes(3);
    expect(mocks.notification).toHaveBeenCalledWith({ message: 'notifications.saveFailed', tone: 'danger' });

    saved = true;
    await act(async () => {
      await mocks.onBack?.();
      await mocks.onStatusChange?.('published');
      await mocks.onDelete?.();
    });
    expect(onBack).toHaveBeenCalledOnce();
    expect(mocks.lifecycleChangeStatus).toHaveBeenCalledWith('published');
    expect(mocks.lifecycleDelete).toHaveBeenCalledOnce();
  });
});
