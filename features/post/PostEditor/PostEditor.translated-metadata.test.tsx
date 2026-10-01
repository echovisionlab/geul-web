// @vitest-environment jsdom

import { act, type ComponentProps, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearEditorSaveRecovery, persistEditorSaveRecoveryEntry } from '@/lib/editor/editor-save-recovery';
import { getPendingEditorPatch } from '@/lib/editor/editor-save-registry';
import { PostEditor } from './PostEditor';

const postId = '11111111-1111-4111-8111-111111111111';
const postSaveDocument = `post:${postId}`;
const recoveryScopes = [`${postSaveDocument}:ko`, `${postSaveDocument}:ja`];

const mocks = vi.hoisted(() => {
  const noOp = vi.fn();
  return {
    postMeta: null as unknown,
    configUpdate: Object.assign(vi.fn(), {
      flush: vi.fn(async () => true),
      isPending: false,
      configuration: {
        slug: null,
        commentsEnabled: true,
        mapPlaceId: null,
        documentLayout: { contentHeight: 'content', pageChrome: 'flow', footer: 'flow' },
      },
    }),
    lifecycle: {
      status: 'draft',
      scheduledAt: null,
      scheduledTimeZone: null,
      permissions: {
        canEdit: true,
        canSchedule: false,
        canDelete: false,
        canAddAuthor: false,
        canRemoveAuthor: false,
        canManageCollaborators: false,
        canViewVersions: false,
        canRestoreVersion: false,
        canManageShareLinks: false,
      },
      statusOptions: [],
      isChanging: false,
      deletePost: { isPending: false, mutate: noOp },
      schedule: { isPending: false, mutate: noOp },
      changeStatus: noOp,
    },
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: vi.fn(), mutateAsync: vi.fn(async () => undefined) }),
}));
vi.mock('@mantine/core', () => ({
  SimpleGrid: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@mantine/hooks', () => ({
  useDisclosure: () => [false, { open: vi.fn(), close: vi.fn() }],
  useWindowEvent: vi.fn(),
}));
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));
vi.mock('@/components/core/Input', () => ({ Checkbox: () => null }));
vi.mock('@/lib/contexts/EditorRuntimeContext', () => ({
  EditorRuntimeProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/lib/contexts/MapPlaceActionContext', () => ({
  MapPlaceActionProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/lib/contexts/PostMetaContext', () => ({
  PostMetaProvider: ({ children }: { children: ReactNode }) => children,
  usePostMeta: () => mocks.postMeta,
}));
vi.mock('@/features/editor/useEditorPermissionRevocation', () => ({
  useEditorPermissionRevocation: () => ({ blocked: false, revoked: false, sessionExpired: false, revoke: vi.fn() }),
}));
vi.mock('@/features/editor/hooks/useBlockRoomTiptapController', () => ({ usePostBlockRoomController: () => null }));
vi.mock('@/features/editor/useEditorNavigation', () => ({
  useEditorNavigation: () => async (action: () => unknown) => action(),
}));
vi.mock('@/lib/hooks/useOgImage', () => ({
  useOgImage: () => ({
    src: null,
    targetKey: 'post-preview',
    status: 'idle',
    error: null,
    isRegenerating: false,
    trackLatest: vi.fn(async () => undefined),
    trackRequestedGeneration: vi.fn(),
  }),
}));
vi.mock('@/lib/hooks/useOgGenerationLookupSignal', () => ({ useOgGenerationLookupSignal: vi.fn() }));
vi.mock('@/lib/hooks/useSlugManagement', () => ({
  useSlugManagement: () => ({ error: null, isChecking: false, handleChange: vi.fn(), handleBlur: vi.fn() }),
}));
vi.mock('./usePostConfigSave', () => ({ usePostConfigSave: () => mocks.configUpdate }));
vi.mock('./usePostLifecycle', () => ({ usePostLifecycle: () => mocks.lifecycle }));
vi.mock('./PostEditorHeaderSection', () => ({
  PostEditorHeaderSection: ({
    title,
    canEditTitle,
    onTitleChange,
  }: {
    title: string;
    canEditTitle: boolean;
    onTitleChange: (value: string) => void;
  }) => (
    <input
      aria-label="Post title"
      data-testid="title"
      disabled={!canEditTitle}
      value={title}
      onChange={(event) => onTitleChange(event.currentTarget.value)}
    />
  ),
}));
vi.mock('@/features/metadata/SummaryFieldCard/SummaryFieldCard', () => ({
  SummaryFieldCard: ({
    summary,
    summaryReadOnly,
    onSummaryChange,
  }: {
    summary: string;
    summaryReadOnly: boolean;
    onSummaryChange?: (value: string) => void;
  }) => (
    <textarea
      aria-label="Post summary"
      data-testid="summary"
      readOnly={summaryReadOnly}
      value={summary}
      onChange={(event) => onSummaryChange?.(event.currentTarget.value)}
    />
  ),
}));
vi.mock('@/features/metadata/MetadataPanel/MetadataPanel', () => ({
  MetadataPanel: ({ title, summary }: { title: string; summary: string }) => (
    <output data-testid="metadata-preview">
      {title}:{summary}
    </output>
  ),
}));

vi.mock('@/components/core/MediaPreviewGrid', () => ({ MediaPreviewGrid: () => null }));
vi.mock('@/features/metadata/OgImagePreview', () => ({ OgImagePreview: () => null }));
vi.mock('@/features/share/ShareLinkSection', () => ({ ShareLinkSection: () => null }));
vi.mock('@/features/metadata/UrlSection', () => ({ UrlSection: () => null }));
vi.mock('@/features/version-history', () => ({ VersionHistoryDrawer: () => null }));
vi.mock('@/features/document-layout', () => ({ ContentLayoutField: () => null }));
vi.mock('@/features/place/CreatePlaceModal', () => ({ CreatePlaceModal: () => null }));
vi.mock('@/features/translation/EditorActiveLocaleControl', () => ({ EditorActiveLocaleControl: () => null }));
vi.mock('@/features/translation/EntityTranslationsPanel', () => ({ EntityTranslationsPanel: () => null }));
vi.mock('./FeaturedImageUploader', () => ({ FeaturedImageUploader: () => null }));
vi.mock('./PostEditorBody', () => ({ PostEditorBody: () => null }));
vi.mock('./PostParticipantsDialog', () => ({ PostParticipantsDialog: () => null }));
vi.mock('./PostPermissionRevokedDialog', () => ({ PostPermissionRevokedDialog: () => null }));
vi.mock('./PostScheduleDialog', () => ({ PostScheduleDialog: () => null }));
vi.mock('./PostSessionExpiredDialog', () => ({ PostSessionExpiredDialog: () => null }));
vi.mock('./CategorySelector', () => ({ CategorySelector: () => null }));
vi.mock('./TagSelector', () => ({ TagSelector: () => null }));
vi.mock('./SeriesSelector', () => ({ SeriesSelector: () => null }));
vi.mock('./LocationSelector', () => ({ LocationSelector: () => null }));

interface MetadataPreview {
  displayTitle: string;
  displaySummary: string;
  activeLocale: string;
}

function metadataPreview({ displayTitle, displaySummary, activeLocale }: MetadataPreview) {
  const protocol = {
    documentName: `${postSaveDocument}:${activeLocale}`,
    subscribeMetadata: () => () => undefined,
    subscribeReady: () => () => undefined,
  };
  return {
    sourceTitle: 'Source title',
    sourceSummary: 'Source summary',
    setSourceTitle: vi.fn(),
    setSourceSummary: vi.fn(),
    slug: null,
    setSlug: vi.fn(),
    commentsEnabled: true,
    setCommentsEnabled: vi.fn(),
    layout: { contentHeight: 'content', pageChrome: 'flow', footer: 'flow' },
    setLayout: vi.fn(),
    featuredImageUrl: null,
    provider: null,
    doc: null,
    isConnected: true,
    isSynced: true,
    bootstrap: {
      documentName: protocol.documentName,
      sourceLocale: 'en',
      locale: activeLocale,
      localeExists: true,
      documentRevision: '10000000-0000-4000-8000-000000000001',
      targetRevision: '10000000-0000-4000-8000-000000000002',
    },
    protocol,
    acceptEpochAck: () => true,
    reloadCanonical: vi.fn(),
    roomLocale: activeLocale,
    localeSession: {
      activeEditLocale: {
        activeLocale,
        activeLocaleLabel: activeLocale,
        sourceLocale: 'en',
        sourceLocaleLabel: 'English',
        isSourceLocale: false,
        isSourceLocaleReady: true,
        hasLiveRow: true,
        canEditActiveLocale: true,
        displayTitle,
        displaySummary,
        displayOgImageUrl: null,
        ogGenerationRun: null,
        contentPreview: '',
        contentPreviewLoading: false,
      },
      mode: { isEditingScopedLocale: true, shouldUseLocaleDocument: true },
      hasRoomMutationAuthority: () => true,
    },
  };
}

const editorProps: ComponentProps<typeof PostEditor> = {
  postId,
  currentMemberId: 'member-1',
  initialTitle: 'Source title',
  initialSummary: 'Source summary',
  initialSlug: null,
  initialStatus: 'draft',
  initialScheduledAt: null,
  initialScheduledTimeZone: null,
  initialAllowedActions: [],
  initialCategories: [],
  initialTags: [],
  initialFeaturedImageUrl: null,
  initialCommentsEnabled: true,
  initialConfigurationRevision: '10000000-0000-4000-8000-000000000001',
  initialDocumentLayout: { contentHeight: 'content', pageChrome: 'flow', footer: 'flow' },
  initialSeriesId: null,
  initialSeriesOrder: null,
  initialMapPlaceId: null,
  initialOgImageUrl: null,
  userName: 'Member',
  isAdmin: false,
  baseUrl: 'https://example.com',
  canonicalOrigin: 'https://example.com',
  siteName: 'Example',
  categories: [],
  tags: [],
  series: [],
  shareLinks: [],
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function renderEditor() {
  await act(async () => {
    root?.render(<PostEditor {...editorProps} />);
  });
}

function editField(testId: 'title' | 'summary', value: string) {
  const selector = testId === 'title' ? 'input' : 'textarea';
  const element = container?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `${selector}[data-testid="${testId}"]`,
  );
  if (!element) {
    throw new Error(`Missing PostEditor ${testId} field`);
  }
  const prototype = testId === 'title' ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

beforeEach(() => {
  vi.useFakeTimers();
  recoveryScopes.forEach((scope) => clearEditorSaveRecovery(scope));
  mocks.postMeta = metadataPreview({
    displayTitle: 'Korean preview title 1',
    displaySummary: 'Korean preview summary 1',
    activeLocale: 'ko',
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  recoveryScopes.forEach((scope) => clearEditorSaveRecovery(scope));
  container?.remove();
  container = null;
  root = null;
  vi.useRealTimers();
});

describe('PostEditor translated metadata drafts', () => {
  it('shows recovered resident metadata instead of retaining the initial source fields', async () => {
    persistEditorSaveRecoveryEntry(`${postSaveDocument}:ko`, 'test-recovery', {
      document: postSaveDocument,
      recoveryKey: 'room-locale',
      patch: { locale: 'ko', title: 'Recovered Korean title', summary: 'Recovered Korean summary' },
      updatedAt: Date.now(),
    });

    await renderEditor();

    expect(container?.querySelector<HTMLInputElement>('[data-testid="title"]')?.value).toBe('Recovered Korean title');
    expect(container?.querySelector<HTMLTextAreaElement>('[data-testid="summary"]')?.value).toBe(
      'Recovered Korean summary',
    );
  });

  it('preserves pending fields through preview refresh and resets drafts on locale scope change', async () => {
    await renderEditor();
    expect(container?.querySelector<HTMLInputElement>('[data-testid="title"]')?.value).toBe('Korean preview title 1');
    expect(container?.querySelector<HTMLTextAreaElement>('[data-testid="summary"]')?.value).toBe(
      'Korean preview summary 1',
    );

    await act(async () => {
      editField('title', 'Local Korean title');
    });
    expect(getPendingEditorPatch(postSaveDocument)).toEqual({ locale: 'ko', title: 'Local Korean title' });

    mocks.postMeta = metadataPreview({
      displayTitle: 'Korean preview title 2',
      displaySummary: 'Korean preview summary 2',
      activeLocale: 'ko',
    });
    await renderEditor();
    expect(container?.querySelector<HTMLInputElement>('[data-testid="title"]')?.value).toBe('Local Korean title');
    expect(container?.querySelector<HTMLTextAreaElement>('[data-testid="summary"]')?.value).toBe(
      'Korean preview summary 2',
    );

    await act(async () => {
      editField('summary', 'Local Korean summary');
    });
    expect(getPendingEditorPatch(postSaveDocument)).toEqual({
      locale: 'ko',
      title: 'Local Korean title',
      summary: 'Local Korean summary',
    });

    mocks.postMeta = metadataPreview({
      displayTitle: 'Korean preview title 3',
      displaySummary: 'Korean preview summary 3',
      activeLocale: 'ko',
    });
    await renderEditor();
    expect(container?.querySelector<HTMLInputElement>('[data-testid="title"]')?.value).toBe('Local Korean title');
    expect(container?.querySelector<HTMLTextAreaElement>('[data-testid="summary"]')?.value).toBe(
      'Local Korean summary',
    );

    mocks.postMeta = metadataPreview({
      displayTitle: 'Japanese preview title',
      displaySummary: 'Japanese preview summary',
      activeLocale: 'ja',
    });
    await renderEditor();
    expect(container?.querySelector<HTMLInputElement>('[data-testid="title"]')?.value).toBe('Japanese preview title');
    expect(container?.querySelector<HTMLTextAreaElement>('[data-testid="summary"]')?.value).toBe(
      'Japanese preview summary',
    );
    expect(getPendingEditorPatch(postSaveDocument)).toEqual({});
  });

  it('updates the untouched title while preserving a pending summary through preview refresh', async () => {
    await renderEditor();

    await act(async () => {
      editField('summary', 'Local Korean summary');
    });
    expect(getPendingEditorPatch(postSaveDocument)).toEqual({ locale: 'ko', summary: 'Local Korean summary' });

    mocks.postMeta = metadataPreview({
      displayTitle: 'Korean preview title 2',
      displaySummary: 'Korean preview summary 2',
      activeLocale: 'ko',
    });
    await renderEditor();

    expect(container?.querySelector<HTMLInputElement>('[data-testid="title"]')?.value).toBe('Korean preview title 2');
    expect(container?.querySelector<HTMLTextAreaElement>('[data-testid="summary"]')?.value).toBe(
      'Local Korean summary',
    );
  });
});
