// @vitest-environment jsdom
import { setProviderAccessLevel } from '@/lib/collab/provider-control-state';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReleaseArtistItem } from '@/lib/types/release/model';

const mocks = vi.hoisted(() => ({
  provider: {},
  header: vi.fn(),
  artists: [] as ReleaseArtistItem[],
  relations: vi.fn(),
  release: vi.fn(),
  updateFields: vi.fn(),
  peer: null as (() => void) | null,
  settleArtists: null as ((success: boolean) => void) | null,
  patch: {} as Record<string, unknown>,
  write: null as ((patch: Record<string, unknown>) => Promise<void>) | null,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }));
vi.mock('next-intl', () => ({ useTranslations: () => Object.assign((key: string) => key, { rich: () => null }) }));
vi.mock('@tanstack/react-query', () => ({
  useMutation: ({ mutationFn }: { mutationFn: (values: unknown) => Promise<unknown> }) => ({
    mutateAsync: mutationFn,
    mutate: vi.fn(),
    isPending: false,
  }),
}));
vi.mock('@/lib/actions/release', () => ({
  getReleaseEditorRelationsAction: mocks.relations,
  getReleaseAdminAction: mocks.release,
  updateReleaseFieldsAction: mocks.updateFields,
  deleteReleaseAction: vi.fn(),
  publishReleaseAction: vi.fn(),
  unpublishReleaseAction: vi.fn(),
  updateReleaseSlugAction: vi.fn(),
}));
vi.mock('@/lib/actions/track', () => ({ getReleaseTrackSnapshotAction: vi.fn(async () => ({ ok: true, value: [] })) }));
vi.mock('@/components/core/Notification', () => ({ notifications: { show: vi.fn() } }));
vi.mock('@/components/core/Input', () => ({
  DateInput: () => null,
  Select: () => null,
  TextInput: ({
    id,
    value,
    onChange,
    disabled,
  }: {
    disabled?: boolean;
    id: string;
    value: string;
    onChange: (event: { currentTarget: { value: string } }) => void;
  }) => (
    <div>
      <output data-testid={id}>{value}</output>
      <button
        type="button"
        disabled={disabled}
        data-testid={`edit-${id}`}
        onClick={() => onChange({ currentTarget: { value: 'local-url' } })}
      >
        Edit
      </button>
    </div>
  ),
}));
vi.mock('@/features/editor/EditorHeader', () => ({
  EditorHeader: (props: unknown) => {
    mocks.header(props);
    return null;
  },
}));
vi.mock('@/features/application-error/QueryErrorAlert', () => ({ QueryErrorAlert: () => null }));
vi.mock('@/features/share/ShareLinkSection', () => ({ ShareLinkSection: () => null }));
vi.mock('@/features/metadata/UrlSection', () => ({ UrlSection: () => null }));
vi.mock('@/features/translation/ActiveEditLocaleContentPreview', () => ({
  ActiveEditLocaleContentPreview: () => null,
}));
vi.mock('@/features/translation/EditorActiveLocaleControl', () => ({ EditorActiveLocaleControl: () => null }));
vi.mock('@/features/translation/EntityTranslationsPanel', () => ({ EntityTranslationsPanel: () => null }));
vi.mock('@/features/translation/useLocaleDocumentSession', () => ({
  useLocaleDocumentSession: () => ({
    activeEditLocale: {
      activeLocale: 'en',
      sourceLocale: 'en',
      isSourceLocale: true,
      canEditActiveLocale: true,
      displayTitle: 'Release',
      localeOptions: [],
    },
    roomLocale: 'en',
    mode: { shouldUseLocaleDocument: true, isEditingScopedLocale: false },
    hasRoomMutationAuthority: () => true,
  }),
}));
vi.mock('@/lib/contexts/EditorRuntimeContext', () => ({
  EditorRuntimeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/lib/editor/editor-save-registry', () => ({
  flushAllEditorSaves: vi.fn(async () => true),
  getPendingEditorPatch: () => ({}),
}));
vi.mock('@/lib/editor/editor-entity-changes', () => ({
  useEditorEntityChanges: (_document: string, callback: () => void) => {
    mocks.peer = callback;
  },
}));
vi.mock('@/lib/editor/useBlockRoomMetadataUpdates', () => ({ useBlockRoomMetadataUpdates: vi.fn() }));
vi.mock('@/lib/editor/useDebouncedRoomMetadata', () => ({ useDebouncedRoomMetadata: () => vi.fn() }));
vi.mock('@/lib/editor/useDebouncedPatch', () => ({
  useDebouncedPatch: ({ write }: { write: typeof mocks.write }) => {
    mocks.write = write;
    return (patch: Record<string, unknown>) => {
      mocks.patch = { ...mocks.patch, ...patch };
    };
  },
}));
vi.mock('@/lib/hooks/useSlugManagement', () => ({ useSlugManagement: () => ({ updateFromTitle: vi.fn() }) }));
vi.mock('@/features/editor/hooks/useBlockRoomTiptapController', () => ({ useRichTextBlockRoomController: () => null }));
vi.mock('@/lib/collab/useBlockRoomConnection', () => ({
  useBlockRoomConnection: () => ({
    provider: mocks.provider,
    doc: null,
    bootstrap: null,
    protocol: null,
    isConnected: true,
    isSynced: true,
  }),
}));
vi.mock('@/lib/collab/block-room-metadata', () => ({ updateBlockRoomLocaleMetadata: vi.fn() }));
vi.mock('@/lib/collab/persist-now', () => ({ persistCollaborativeDocumentNow: vi.fn() }));
vi.mock('./ReleaseArtistsSection', () => ({
  ReleaseArtistsSection: ({
    artists,
    onArtistsChange,
    onMutationStart,
    onMutationSettled,
  }: {
    artists: ReleaseArtistItem[];
    onArtistsChange: (artists: ReleaseArtistItem[]) => void;
    onMutationStart: () => void;
    onMutationSettled: (success: boolean) => void;
  }) => (
    <div>
      <output data-testid="artists">{artists.map((artist) => artist.artist_name).join(',')}</output>
      <button
        type="button"
        data-testid="edit-artists"
        onClick={() => {
          onArtistsChange([{ artist_id: 'local', artist_name: 'Local', artist_slug: null, sort_order: 0 }]);
          onMutationStart();
          mocks.settleArtists = onMutationSettled;
        }}
      >
        Edit artists
      </button>
    </div>
  ),
}));
vi.mock('./ReleaseArtworkUploader', () => ({ ReleaseArtworkUploader: () => null }));
vi.mock('./ReleaseCreditsSection', () => ({ ReleaseCreditsSection: () => null }));
vi.mock('./ReleaseDescriptionEditor', () => ({ ReleaseDescriptionEditor: () => null }));
vi.mock('./ReleaseLabelsSection', () => ({ ReleaseLabelsSection: () => null }));
vi.mock('./ReleaseTagsSection', () => ({ ReleaseTagsSection: () => null }));
vi.mock('./ReleaseTracksSection', () => ({ ReleaseTracksSection: () => null }));

import { ReleaseEditor } from './ReleaseEditor';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { resolve, promise };
}
const initialArtist: ReleaseArtistItem = {
  artist_id: 'original',
  artist_name: 'Original',
  artist_slug: null,
  sort_order: 0,
};
const props = {
  releaseId: 'release-1',
  initialTitle: 'Release',
  initialSlug: null,
  initialType: 'album' as const,
  initialReleaseDate: null,
  initialArtworkUrl: null,
  initialStatus: 'draft',
  initialSpotifyUrl: 'original-url',
  initialAppleMusicUrl: null,
  initialBandcampUrl: null,
  initialYoutubeMusicUrl: null,
  initialArtists: [initialArtist],
  initialCredits: [],
  initialLabels: [],
  initialCategories: [],
  initialGenres: [],
  initialStyles: [],
  initialFormats: [],
  initialTracks: [],
  baseUrl: 'https://example.test',
};
const relations = () => ({
  artists: mocks.artists,
  credits: [],
  labels: [],
  categories: [],
  genres: [],
  styles: [],
  formats: [],
});

describe('Release authoritative configuration', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    setProviderAccessLevel(mocks.provider, 'edit');
    mocks.artists = [initialArtist];
    mocks.relations.mockReset().mockImplementation(async () => relations());
    mocks.release.mockReset().mockImplementation(async () => ({
      type: 'album',
      releaseDate: null,
      artworkUrl: null,
      spotifyUrl: 'original-url',
    }));
    mocks.updateFields.mockReset().mockResolvedValue({ success: true });
    mocks.peer = null;
    mocks.settleArtists = null;
    mocks.patch = {};
    mocks.write = null;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('upgrades and downgrades fields while preserving all release sections', async () => {
    setProviderAccessLevel(mocks.provider, 'view');
    await act(async () => root.render(<ReleaseEditor {...props} />));
    const url = container.querySelector('[data-testid="edit-release-release-1-spotify-url"]') as HTMLButtonElement;
    const artists = container.querySelector('[data-testid="artists"]');
    expect(url.disabled).toBe(true);
    expect(mocks.header.mock.lastCall?.[0].onDelete).toBeUndefined();
    act(() => setProviderAccessLevel(mocks.provider, 'edit'));
    expect(url.disabled).toBe(false);
    expect(mocks.header.mock.lastCall?.[0].onDelete).toBeTypeOf('function');
    expect(container.querySelector('[data-testid="artists"]')).toBe(artists);
    act(() => setProviderAccessLevel(mocks.provider, 'view'));
    expect(url.disabled).toBe(true);
    expect(mocks.header.mock.lastCall?.[0].onDelete).toBeUndefined();
    expect(container.querySelector('[data-testid="artists"]')).toBe(artists);
  });

  it('preserves a pending scalar draft across an authoritative peer refresh', async () => {
    await act(async () => root.render(<ReleaseEditor {...props} />));
    act(() =>
      container.querySelector<HTMLButtonElement>('[data-testid="edit-release-release-1-spotify-url"]')!.click(),
    );
    await act(async () => {
      mocks.peer?.();
    });
    expect(container.querySelector('[data-testid="release-release-1-spotify-url"]')?.textContent).toBe('local-url');
    expect(mocks.patch).toEqual({ spotifyUrl: 'local-url' });
  });

  it('drops a relation read begun before a mutation that resolves after its settlement', async () => {
    const stale = deferred<ReturnType<typeof relations>>();
    const oldRelations = relations();
    mocks.relations.mockImplementationOnce(() => stale.promise);
    await act(async () => root.render(<ReleaseEditor {...props} />));
    act(() => mocks.peer?.());
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="edit-artists"]')!.click());
    mocks.artists = [{ artist_id: 'local', artist_name: 'Local', artist_slug: null, sort_order: 0 }];
    await act(async () => {
      mocks.settleArtists?.(true);
    });
    expect(container.querySelector('[data-testid="artists"]')?.textContent).toBe('Local');
    await act(async () => {
      stale.resolve(oldRelations);
      await stale.promise;
    });
    expect(container.querySelector('[data-testid="artists"]')?.textContent).toBe('Local');
  });
  it('releases a failed finished relation intent so later authoritative edits remain visible', async () => {
    await act(async () => root.render(<ReleaseEditor {...props} />));
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="edit-artists"]')!.click());
    await act(async () => {
      mocks.settleArtists?.(false);
    });
    expect(container.querySelector('[data-testid="artists"]')?.textContent).toBe('Original');
    mocks.artists = [{ artist_id: 'remote', artist_name: 'Remote', artist_slug: null, sort_order: 0 }];
    await act(async () => {
      mocks.peer?.();
    });
    expect(container.querySelector('[data-testid="artists"]')?.textContent).toBe('Remote');
  });
});
