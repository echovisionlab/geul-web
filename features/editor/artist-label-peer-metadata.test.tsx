// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtistAction } from '@echovisionlab/geul-proto/secure/artist_pb.ts';
import { LabelAction } from '@echovisionlab/geul-proto/secure/label_pb.ts';
import type { BlockRoomMetadataUpdate } from '@/lib/collab/block-room-protocol';

const mocks = vi.hoisted(() => ({
  listeners: [] as Array<(update: BlockRoomMetadataUpdate) => void>,
  connection: null as null | Record<string, unknown>,
  headerBack: null as null | (() => void | Promise<void>),
  headerStatusChange: null as null | ((status: string) => void | Promise<void>),
  headerDelete: null as null | (() => void | Promise<void>),
  routerBack: vi.fn(),
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
  routerRefresh: vi.fn(),
  mutation: vi.fn(),
  notification: vi.fn(),
  deleteOpened: false,
  bootstrapUpdates: [] as BlockRoomMetadataUpdate[],
  writes: [] as Record<string, unknown>[],
  metadataOperations: [] as string[],
  inputValues: {} as Record<string, string>,
  inputChanges: {} as Record<string, (value: string) => void>,
  socialValue: '',
  socialChange: null as null | ((value: Record<string, string>) => void),
  labelValue: '',
  labelChange: null as null | ((value: string[]) => void),
  title: '',
  titleChange: null as null | ((value: string) => void),
  labelCancel: null as null | (() => void | Promise<void>),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    back: mocks.routerBack,
    push: mocks.routerPush,
    replace: mocks.routerReplace,
    refresh: mocks.routerRefresh,
  }),
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ mutate: mocks.mutation, isPending: false }),
  useQuery: () => ({ data: [] }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('@mantine/notifications', () => ({ notifications: { show: mocks.notification } }));
vi.mock('@mantine/core', () => ({
  Group: 'div',
  SimpleGrid: 'div',
  Stack: 'div',
  Text: 'span',
}));
vi.mock('@tabler/icons-react', () => ({ IconUsers: () => null }));
vi.mock('@/components/core/Input', () => ({
  MultiSelect: ({ id, value, onChange }: { id: string; value: string[]; onChange: (value: string[]) => void }) => {
    mocks.labelValue = value.join(',');
    mocks.labelChange = onChange;
    return createElement('div', { 'data-testid': id }, mocks.labelValue);
  },
  Select: ({ id, value }: { id: string; value: string | null }) =>
    createElement('div', { 'data-testid': id }, value ?? ''),
  TextInput: ({
    id,
    value,
    onChange,
  }: {
    id: string;
    value: string;
    onChange: (event: { currentTarget: { value: string } }) => void;
  }) => {
    mocks.inputValues[id] = value;
    mocks.inputChanges[id] = (nextValue) => onChange({ currentTarget: { value: nextValue } });
    return createElement('div', { 'data-testid': id }, value);
  },
}));
vi.mock('@/components/core/Button', () => ({
  Button: ({ children, onClick }: { children: unknown; onClick?: () => void | Promise<void> }) => {
    if (children === 'actions.cancel') {
      mocks.labelCancel = onClick ?? null;
    }
    return createElement('button', { type: 'button', onClick }, children as never);
  },
}));
vi.mock('@/features/editor/EditorHeader', () => ({
  EditorHeader: ({
    title,
    onTitleChange,
    onBack,
    onStatusChange,
    onDelete,
  }: {
    title: string;
    onTitleChange?: (value: string) => void;
    onBack?: () => void | Promise<void>;
    onStatusChange?: (status: string) => void | Promise<void>;
    onDelete?: () => void | Promise<void>;
  }) => {
    mocks.title = title;
    mocks.titleChange = onTitleChange ?? null;
    mocks.headerBack = onBack ?? null;
    mocks.headerStatusChange = onStatusChange ?? null;
    mocks.headerDelete = onDelete ?? null;
    return createElement('div', { 'data-testid': 'editor-title' }, title);
  },
}));
vi.mock('@/features/editor/EditorPermissionRevokedDialog', () => ({ EditorPermissionRevokedDialog: () => null }));
vi.mock('@/features/editor/EditorSessionExpiredDialog', () => ({ EditorSessionExpiredDialog: () => null }));
vi.mock('@/features/location/CountryCodeSelect', () => ({
  CountryCodeSelect: ({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) => {
    mocks.inputValues[id] = value;
    mocks.inputChanges[id] = onChange;
    return createElement('div', { 'data-testid': id }, value);
  },
}));
vi.mock('@/features/social-links/SocialLinksEditor', () => ({
  SocialLinksEditor: ({
    idPrefix,
    value,
    onChange,
  }: {
    idPrefix: string;
    value: Record<string, string>;
    onChange: (value: Record<string, string>) => void;
  }) => {
    mocks.socialValue = JSON.stringify(value);
    mocks.socialChange = onChange;
    return createElement('div', { 'data-testid': idPrefix }, mocks.socialValue);
  },
}));
vi.mock('@/features/editor/EditorPermissionRevokedDialog', () => ({ EditorPermissionRevokedDialog: () => null }));
vi.mock('@/features/editor/EditorSessionExpiredDialog', () => ({ EditorSessionExpiredDialog: () => null }));
vi.mock('@/features/artist/ArtistEditor/ArtistParentSelect', () => ({ ArtistParentSelect: () => null }));
vi.mock('@/features/artist/ArtistEditor/ArtistBioEditor', () => ({ ArtistBioEditor: () => null }));
vi.mock('@/features/artist/ArtistEditor/ArtistImageGalleryEditor', () => ({ ArtistImageGalleryEditor: () => null }));
vi.mock('@/features/artist/ArtistEditor/ArtistParticipantsDialog', () => ({ ArtistParticipantsDialog: () => null }));
vi.mock('@/features/artist/ArtistDeleteDialog', () => ({
  ArtistDeleteDialog: ({ artist }: { artist: unknown }) => {
    mocks.deleteOpened = Boolean(artist);
    return null;
  },
}));
vi.mock('@/features/artist/ArtistImageCropper', () => ({ ArtistImageCropper: () => null }));
vi.mock('@/features/label/LabelEditor/LabelDescriptionEditor', () => ({ LabelDescriptionEditor: () => null }));
vi.mock('@/features/label/LabelEditor/LabelParticipantsDialog', () => ({ LabelParticipantsDialog: () => null }));
vi.mock('@/features/label/LabelLogoUploader', () => ({ LabelLogoUploader: () => null }));
vi.mock('@/features/metadata/UrlSection', () => ({ UrlSection: () => null }));
vi.mock('@/features/metadata/OgImagePreview', () => ({ OgImagePreview: () => null }));
vi.mock('@/features/share/ShareLinkSection', () => ({ ShareLinkSection: () => null }));
vi.mock('@/features/translation/ActiveEditLocaleContentPreview', () => ({
  ActiveEditLocaleContentPreview: () => null,
}));
vi.mock('@/features/translation/EditorActiveLocaleControl', () => ({ EditorActiveLocaleControl: () => null }));
vi.mock('@/features/translation/EditorActiveLocaleMenu', () => ({ EditorActiveLocaleMenu: () => null }));
vi.mock('@/features/translation/EntityTranslationsPanel', () => ({ EntityTranslationsPanel: () => null }));
vi.mock('@/lib/contexts/EditorRuntimeContext', () => ({
  EditorRuntimeProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/contexts/LocaleProvider', () => ({ useLocale: () => 'en' }));
vi.mock('@/lib/hooks/useSlugManagement', () => ({
  useSlugManagement: () => ({ error: null, isChecking: false, handleChange: vi.fn(), handleBlur: vi.fn() }),
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
vi.mock('@/features/editor/hooks/useBlockRoomTiptapController', () => ({
  useRichTextBlockRoomController: () => ({}),
}));
vi.mock('@/features/editor/useEditorPermissionRevocation', () => ({
  useEditorPermissionRevocation: () => ({ blocked: false, revoked: false, sessionExpired: false }),
}));
vi.mock('@/features/translation/useLocaleDocumentSession', () => ({
  useLocaleDocumentSession: () => ({
    roomLocale: 'en',
    activeEditLocale: {
      activeLocale: 'en',
      activeLocaleLabel: 'English',
      sourceLocale: 'en',
      displayTitle: 'Initial title',
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
    mode: { isEditingScopedLocale: false, hasScopedLocaleLiveRow: true, shouldUseLocaleDocument: true },
    hasRoomMutationAuthority: () => true,
  }),
}));
vi.mock('@/lib/collab/useBlockRoomConnection', () => ({
  useBlockRoomConnection: () => mocks.connection,
}));
vi.mock('@/lib/editor/useDebouncedRoomMetadata', () => ({
  useDebouncedRoomMetadata: (options: { operation?: string }) => {
    const operation = options.operation ?? 'locale';
    if (!mocks.metadataOperations.includes(operation)) {
      mocks.metadataOperations.push(operation);
    }
    return (patch: Record<string, unknown>) => {
      mocks.writes.push(patch);
    };
  },
}));

import { ArtistDetailEditor } from '@/features/artist/ArtistEditor/ArtistDetailEditor';
import { AdminLabelDetailClient } from '@/features/label/AdminLabelDetailClient';
import { registerEditorSave } from '@/lib/editor/editor-save-registry';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const artist = {
  id: 'artist-1',
  name: 'Initial title',
  status: 'draft',
  realName: 'Initial real name',
  countryCode: 'US',
  website: 'https://initial.example',
  socialLinks: { instagram: 'initial' },
  slug: 'artist-initial',
  labelIds: ['label-initial'],
  parentArtistId: null,
  allowedActions: [],
  ogImageUrl: null,
  images: [],
  imageRevision: 0,
} as never;

const label = {
  id: 'label-1',
  name: 'Initial title',
  status: 'draft',
  countryCode: 'US',
  website: 'https://initial.example',
  socialLinks: { instagram: 'initial' },
  slug: 'label-initial',
  parentLabelId: null,
  imageLightUrl: null,
  imageDarkUrl: null,
  allowedActions: [],
} as never;

let container: HTMLDivElement;
let root: Root;
let unregisterPendingSave: (() => void) | null;

beforeEach(() => {
  vi.clearAllMocks();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  unregisterPendingSave = null;
  mocks.listeners = [];
  mocks.connection = {
    provider: {},
    doc: {},
    bootstrap: { sourceLocale: 'en', locale: 'en', localeExists: true },
    protocol: {
      subscribeMetadata: (listener: (update: BlockRoomMetadataUpdate) => void) => {
        mocks.listeners.push(listener);
        mocks.bootstrapUpdates.forEach(listener);
        return () => {
          mocks.listeners = mocks.listeners.filter((current) => current !== listener);
        };
      },
      updateMetadata: vi.fn(),
      getSnapshot: vi.fn(),
    },
    isConnected: true,
    isSynced: true,
  };
  mocks.bootstrapUpdates = [];
  mocks.writes = [];
  mocks.metadataOperations = [];
  mocks.inputValues = {};
  mocks.inputChanges = {};
  mocks.socialValue = '';
  mocks.socialChange = null;
  mocks.labelValue = '';
  mocks.labelChange = null;
  mocks.title = '';
  mocks.titleChange = null;
  mocks.headerBack = null;
  mocks.headerStatusChange = null;
  mocks.headerDelete = null;
  mocks.labelCancel = null;
  mocks.deleteOpened = false;
});

afterEach(() => {
  act(() => root.unmount());
  unregisterPendingSave?.();
  container.remove();
});

function renderArtist() {
  act(() => root.render(<ArtistDetailEditor id="artist-1" artist={artist} baseUrl="https://example.test" />));
}

function renderLabel() {
  act(() => root.render(<AdminLabelDetailClient id="label-1" label={label} baseUrl="https://example.test" />));
}

describe('Artist and Label peer metadata adoption', () => {
  it('adopts bootstrap and peer Artist metadata, protects queued local fields, and sends observed values', () => {
    mocks.bootstrapUpdates = [
      { operation: 'locale', values: { title: 'Canonical Artist' }, sequence: 1 },
      {
        operation: 'document',
        values: {
          realName: 'Canonical real name',
          countryCode: 'US',
          website: 'https://canonical.example',
          socialLinks: { instagram: 'canonical' },
          labelIds: ['label-canonical'],
          slug: 'artist-canonical',
          parentArtistId: null,
        },
        sequence: 1,
      },
    ];
    renderArtist();

    expect(mocks.metadataOperations).toEqual(['locale', 'document']);

    expect(mocks.title).toBe('Canonical Artist');
    expect(mocks.inputValues['artist-artist-1-website']).toBe('https://canonical.example');
    expect(mocks.labelValue).toBe('label-canonical');
    expect(mocks.socialValue).toBe(JSON.stringify({ instagram: 'canonical' }));

    act(() => mocks.inputChanges['artist-artist-1-website']('https://local.example'));
    act(() => mocks.socialChange?.({ instagram: 'local-social' }));
    act(() => mocks.labelChange?.(['label-local']));
    expect(mocks.writes).toContainEqual({
      socialLinks: { instagram: 'local-social' },
      observed: { socialLinks: { instagram: 'canonical' } },
    });
    expect(mocks.writes).toContainEqual({ labelIds: ['label-local'], observed: { labelIds: ['label-canonical'] } });
    act(() => mocks.socialChange?.({ instagram: 'local-social-next' }));
    act(() => mocks.labelChange?.(['label-local-next']));
    expect(mocks.writes).toContainEqual({
      socialLinks: { instagram: 'local-social-next' },
      observed: { socialLinks: { instagram: 'local-social' } },
    });
    expect(mocks.writes).toContainEqual({ labelIds: ['label-local-next'], observed: { labelIds: ['label-local'] } });

    unregisterPendingSave = registerEditorSave('artist:artist-1', {
      flush: async () => true,
      hasPending: () => true,
      getPendingPatch: () => ({ website: true, socialLinks: true, labelIds: true }),
    });
    act(() =>
      mocks.listeners[0]({
        operation: 'locale',
        values: { title: 'Peer Artist' },
        sequence: 2,
      }),
    );
    act(() =>
      mocks.listeners[0]({
        operation: 'document',
        values: {
          website: 'https://peer.example',
          countryCode: 'CA',
          socialLinks: { instagram: 'peer-social' },
          labelIds: ['label-peer'],
        },
        sequence: 2,
      }),
    );

    expect(mocks.title).toBe('Peer Artist');
    expect(mocks.inputValues['artist-artist-1-website']).toBe('https://local.example');
    expect(mocks.inputValues['artist-artist-1-country-code']).toBe('CA');
    expect(mocks.socialValue).toBe(JSON.stringify({ instagram: 'local-social-next' }));
    expect(mocks.labelValue).toBe('label-local-next');
    expect(mocks.writes).toHaveLength(5);
  });

  it('adopts bootstrap and peer Label metadata without re-saving peer changes', () => {
    mocks.bootstrapUpdates = [
      { operation: 'locale', values: { title: 'Canonical Label' }, sequence: 1 },
      {
        operation: 'document',
        values: {
          countryCode: 'US',
          website: 'https://canonical.example',
          socialLinks: { instagram: 'canonical' },
          slug: 'label-canonical',
          parentLabelId: null,
        },
        sequence: 1,
      },
    ];
    renderLabel();

    expect(mocks.metadataOperations).toEqual(['locale', 'document']);

    expect(mocks.title).toBe('Canonical Label');
    expect(mocks.inputValues['label-label-1-website']).toBe('https://canonical.example');
    expect(mocks.socialValue).toBe(JSON.stringify({ instagram: 'canonical' }));

    act(() => mocks.socialChange?.({ instagram: 'local-label-social' }));
    expect(mocks.writes).toContainEqual({
      socialLinks: { instagram: 'local-label-social' },
      observed: { socialLinks: { instagram: 'canonical' } },
    });
    const writesBeforePeer = mocks.writes.length;
    unregisterPendingSave = registerEditorSave('label:label-1', {
      flush: async () => true,
      hasPending: () => true,
      getPendingPatch: () => ({ socialLinks: true }),
    });
    act(() => mocks.listeners[0]({ operation: 'locale', values: { title: 'Peer Label' }, sequence: 2 }));
    act(() =>
      mocks.listeners[0]({
        operation: 'document',
        values: {
          countryCode: 'JP',
          website: 'https://peer.example',
          socialLinks: { instagram: 'peer-social' },
          slug: 'label-peer',
        },
        sequence: 2,
      }),
    );

    expect(mocks.title).toBe('Peer Label');
    expect(mocks.inputValues['label-label-1-country-code']).toBe('JP');
    expect(mocks.inputValues['label-label-1-website']).toBe('https://peer.example');
    expect(mocks.socialValue).toBe(JSON.stringify({ instagram: 'local-label-social' }));
    expect(mocks.writes).toHaveLength(writesBeforePeer);
  });
});

describe('Artist and Label save barriers', () => {
  it('waits for registered Artist saves before navigating back', async () => {
    let resolveFlush: ((result: boolean) => void) | undefined;
    let pending = true;
    unregisterPendingSave = registerEditorSave('artist:artist-1', {
      flush: () => new Promise((resolve) => (resolveFlush = resolve)),
      hasPending: () => pending,
      getPendingPatch: () => ({ website: 'https://local.example' }),
    });
    renderArtist();

    let navigation: Promise<void> | undefined;
    act(() => {
      navigation = Promise.resolve(mocks.headerBack?.());
    });
    expect(mocks.routerBack).not.toHaveBeenCalled();

    await act(async () => {
      pending = false;
      resolveFlush?.(true);
      await navigation;
    });
    expect(mocks.routerBack).toHaveBeenCalledOnce();
  });

  it('keeps the Label editor open and blocks status changes when pending saves fail', async () => {
    unregisterPendingSave = registerEditorSave('label:label-1', {
      flush: async () => false,
      hasPending: () => true,
      getPendingPatch: () => ({ socialLinks: { instagram: 'local' } }),
    });
    const publishableLabel = { ...(label as object), allowedActions: [LabelAction.PUBLISH] } as never;
    act(() =>
      root.render(<AdminLabelDetailClient id="label-1" label={publishableLabel} baseUrl="https://example.test" />),
    );
    expect(mocks.labelCancel).toBeTypeOf('function');

    await act(async () => {
      await mocks.headerBack?.();
      await mocks.labelCancel?.();
      await mocks.headerStatusChange?.('published');
    });

    expect(mocks.routerPush).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
    expect(mocks.notification).toHaveBeenCalledWith({ message: 'notifications.saveFailed', color: 'red' });
  });

  it('does not open the Artist delete confirmation when pending saves fail', async () => {
    unregisterPendingSave = registerEditorSave('artist:artist-1', {
      flush: async () => false,
      hasPending: () => true,
      getPendingPatch: () => ({ socialLinks: { instagram: 'local' } }),
    });
    const deletableArtist = { ...(artist as object), allowedActions: [ArtistAction.DELETE] } as never;
    act(() =>
      root.render(<ArtistDetailEditor id="artist-1" artist={deletableArtist} baseUrl="https://example.test" />),
    );

    await act(async () => {
      await mocks.headerDelete?.();
    });

    expect(mocks.deleteOpened).toBe(false);
    expect(mocks.notification).toHaveBeenCalledWith({ message: 'notifications.saveFailed', color: 'red' });
  });
});
