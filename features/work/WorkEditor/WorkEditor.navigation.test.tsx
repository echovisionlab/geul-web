// @vitest-environment jsdom

import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  onBack: null as null | (() => void | Promise<void>),
  onStatusChange: null as null | ((status: string) => void | Promise<void>),
  onDelete: null as null | (() => void | Promise<void>),
  routerBack: vi.fn(),
  notification: vi.fn(),
  lifecycleChangeStatus: vi.fn(),
  lifecycleDelete: vi.fn(),
  meta: null as null | Record<string, unknown>,
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ back: mocks.routerBack, refresh: vi.fn() }) }));
vi.mock('next-intl', () => ({
  useTranslations: () => Object.assign((key: string) => key, { rich: (key: string) => key }),
}));
vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
}));
vi.mock('@mantine/notifications', () => ({ notifications: { show: mocks.notification } }));
vi.mock('@mantine/core', () => ({ Box: 'div', Stack: 'div', Text: 'span' }));
vi.mock('@tabler/icons-react', () => ({ IconHistory: () => null }));
vi.mock('@/features/editor/EditorHeader', () => ({
  EditorHeader: ({
    onBack,
    onStatusChange,
    onDelete,
  }: {
    onBack?: () => void | Promise<void>;
    onStatusChange?: (status: string) => void | Promise<void>;
    onDelete?: () => void | Promise<void>;
  }) => {
    mocks.onBack = onBack ?? null;
    mocks.onStatusChange = onStatusChange ?? null;
    mocks.onDelete = onDelete ?? null;
    return null;
  },
}));
vi.mock('@/components/core/MediaPreviewGrid', () => ({ MediaPreviewGrid: 'div' }));
vi.mock('@/components/core/Section', () => ({ SectionCard: 'div' }));
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
    updateFromTitle: vi.fn(),
  }),
}));
vi.mock('@/lib/collab/block-room-metadata', () => ({ updateBlockRoomLocaleMetadata: vi.fn() }));
vi.mock('@/lib/editor/editor-entity-changes', () => ({
  publishEditorEntityChange: vi.fn(),
  useEditorEntityChanges: vi.fn(),
}));
vi.mock('@/lib/editor/useBlockRoomMetadataUpdates', () => ({ useBlockRoomMetadataUpdates: vi.fn() }));
vi.mock('@/lib/editor/useDebouncedPatch', () => ({ useDebouncedPatch: () => vi.fn() }));
vi.mock('@/lib/editor/useDebouncedRoomMetadata', () => ({ useDebouncedRoomMetadata: () => vi.fn() }));
vi.mock('@/features/work/WorkEditor/WorkCreditsSection', () => ({ WorkCreditsSection: () => null }));
vi.mock('@/features/work/WorkEditor/WorkClientsSection', () => ({ WorkClientsSection: () => null }));
vi.mock('@/features/work/WorkEditor/WorkFeaturedImageUploader', () => ({ WorkFeaturedImageUploader: () => null }));
vi.mock('@/features/work/WorkEditor/WorkMetaForm', () => ({ WorkMetaForm: () => null }));
vi.mock('@/features/work/WorkEditor/useWorkLifecycle', () => ({
  useWorkLifecycle: () => ({
    status: 'draft',
    canEdit: true,
    controls: { statusOptions: [], canDelete: true },
    changeStatus: mocks.lifecycleChangeStatus,
    deleteWork: { mutate: mocks.lifecycleDelete, isPending: false },
    isChanging: false,
  }),
}));

import { WorkEditor } from '@/features/work/WorkEditor/WorkEditor';
import { registerEditorSave } from '@/lib/editor/editor-save-registry';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

let container: HTMLDivElement;
let root: Root;
let unregisterPendingSave: (() => void) | null;

beforeEach(() => {
  vi.clearAllMocks();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  unregisterPendingSave = null;
  mocks.onBack = null;
  mocks.onStatusChange = null;
  mocks.onDelete = null;
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
  act(() => root.unmount());
  unregisterPendingSave?.();
  container.remove();
});

function renderWork(onBack?: () => void) {
  act(() => root.render(<WorkEditor {...props} onBack={onBack} />));
}

describe('WorkEditor navigation save barriers', () => {
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

  it('blocks Work status and delete actions when registered saves fail', async () => {
    unregisterPendingSave = registerEditorSave('work:work-1', {
      flush: async () => false,
      hasPending: () => true,
      getPendingPatch: () => ({ metadata: { local: true } }),
    });
    renderWork();
    expect(mocks.onStatusChange).toBeTypeOf('function');
    expect(mocks.onDelete).toBeTypeOf('function');

    await act(async () => {
      await mocks.onStatusChange?.('published');
      await mocks.onDelete?.();
    });

    expect(mocks.lifecycleChangeStatus).not.toHaveBeenCalled();
    expect(mocks.lifecycleDelete).not.toHaveBeenCalled();
    expect(mocks.notification).toHaveBeenCalledTimes(2);
  });
});
