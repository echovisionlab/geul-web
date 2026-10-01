// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const subscribeMetadata = vi.fn();
  return {
    archiveEvent: vi.fn(),
    back: vi.fn(),
    deleteEvent: vi.fn(),
    getNeutralConfiguration: vi.fn(),
    notification: vi.fn(),
    publishEvent: vi.fn(),
    protocol: { subscribeMetadata },
    subscribeMetadata,
    updateEvent: vi.fn(),
    metadataListener: null as
      | null
      | ((update: {
          operation: 'locale' | 'document' | 'page_layout';
          values: Record<string, unknown>;
          sequence: number;
        }) => void),
  };
});

vi.mock('next/navigation', () => ({ useRouter: () => ({ back: mocks.back, push: vi.fn() }) }));
vi.mock('next-intl', () => ({
  useTranslations: () => {
    const translate = ((key: string) => key) as ((key: string) => string) & {
      rich: (key: string, values?: Record<string, (chunks: string) => ReactNode>) => ReactNode;
    };
    translate.rich = (key: string) => key;
    return translate;
  },
}));
vi.mock('@mantine/notifications', () => ({ notifications: { show: mocks.notification } }));
vi.mock('@/features/editor/EditorHeader', () => ({
  EditorHeader: ({
    onBack,
    onStatusChange,
    onDelete,
    title,
  }: {
    onBack?: () => void;
    onStatusChange?: (status: 'published' | 'archived') => void;
    onDelete?: () => void;
    title: string;
  }) => (
    <div>
      <div data-testid="event-title">{title}</div>
      <button type="button" data-testid="back" onClick={() => onBack?.()}>
        back
      </button>
      {onStatusChange ? (
        <button type="button" data-testid="publish" onClick={() => onStatusChange('published')}>
          publish
        </button>
      ) : null}
      {onDelete ? (
        <button type="button" data-testid="delete" onClick={() => onDelete()}>
          delete
        </button>
      ) : null}
    </div>
  ),
}));
vi.mock('@/components/core/Input', () => ({
  MultiSelect: ({ label, onChange }: { label: string; onChange: (values: string[]) => void }) => {
    const field = label.endsWith('artists') ? 'artists' : label.endsWith('labels') ? 'labels' : 'clients';
    return (
      <>
        <button type="button" data-testid={`relation-${field}`} onClick={() => onChange([`${field}-next`])}>
          {field}
        </button>
        <button type="button" data-testid={`relation-${field}-latest`} onClick={() => onChange([`${field}-latest`])}>
          {field} latest
        </button>
      </>
    );
  },
  NumberInput: () => null,
  Select: () => null,
  TextInput: () => null,
  Checkbox: () => null,
}));
vi.mock('@/components/core/MediaPreviewGrid', () => ({
  MediaPreviewGrid: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/core/Section', () => ({
  SectionCard: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  SectionHeader: ({ title }: { title: ReactNode }) => <h2>{title}</h2>,
}));
vi.mock('@/features/metadata/UrlSection', () => ({
  UrlSection: ({ onChange }: { onChange: (value: string) => void }) => (
    <button type="button" data-testid="slug-change" onClick={() => onChange('next-slug')}>
      Change slug
    </button>
  ),
}));
vi.mock('@/features/site/PageLoader', () => ({ PageLoader: () => null }));
vi.mock('@/features/metadata/MetadataPanel/MetadataPanel', () => ({ MetadataPanel: () => null }));
vi.mock('@/features/metadata/SummaryFieldCard/SummaryFieldCard', () => ({
  SummaryFieldCard: ({ summary }: { summary: string }) => <div data-testid="event-summary">{summary}</div>,
}));
vi.mock('@/features/place/CreatePlaceModal', () => ({ CreatePlaceModal: () => null }));
vi.mock('@/features/post/PostEditor/LocationSelector', () => ({ LocationSelector: () => null }));
vi.mock('@/features/translation/EditorActiveLocaleControl', () => ({ EditorActiveLocaleControl: () => null }));
vi.mock('@/features/translation/EntityTranslationsPanel', () => ({ EntityTranslationsPanel: () => null }));
vi.mock('@/features/translation/LocalizedRichTextFragmentEditor', () => ({
  LocalizedRichTextFragmentEditor: () => null,
}));
vi.mock('@/features/translation/useLocaleDocumentSession', () => ({
  useLocaleDocumentSession: () => ({
    activeEditLocale: {
      activeLocale: 'en',
      canEditActiveLocale: true,
      displaySummary: '',
      displayTitle: 'Event',
      hasLiveRow: true,
      isLoading: false,
      isSourceLocale: true,
      sourceLocale: 'en',
    },
    hasRoomMutationAuthority: () => true,
    mode: { shouldUseLocaleDocument: true },
    roomLocale: 'en',
  }),
}));
vi.mock('@/features/editor/hooks/useRichTextBlockRoomEditor', () => ({
  useRichTextBlockRoomEditor: () => ({
    acceptEpochAck: () => true,
    bootstrap: { documentRevision: 'revision-1', locale: 'en', localeExists: true, sourceLocale: 'en' },
    controller: {},
    doc: {},
    isConnected: true,
    isSynced: true,
    protocol: mocks.protocol,
    provider: null,
    reloadCanonical: vi.fn(),
  }),
}));
vi.mock('@/lib/contexts/EditorRuntimeContext', () => ({
  EditorRuntimeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useOptionalEditorRuntimeContext: () => null,
}));
vi.mock('@/lib/contexts/MapPlaceActionContext', () => ({
  MapPlaceActionProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/lib/api/map-place-browser-client', () => ({
  createMapPlaceForBlockWithBrowserClient: vi.fn(),
  createMapPlaceWithBrowserClient: vi.fn(),
}));
vi.mock('@/lib/actions/program-event', () => ({
  archiveProgramEventAction: mocks.archiveEvent,
  createProgramEventTypeAction: vi.fn(),
  deleteProgramEventAction: mocks.deleteEvent,
  getProgramEventNeutralConfigurationAction: mocks.getNeutralConfiguration,
  publishProgramEventAction: mocks.publishEvent,
  updateProgramEventAction: mocks.updateEvent,
}));
vi.mock('./ProgramEventCreditsSection', () => ({ ProgramEventCreditsSection: () => null }));
vi.mock('./ProgramEventPosterUploader', () => ({ ProgramEventPosterUploader: () => null }));

import { ProgramEventEditor } from './ProgramEventEditor';
import { clearEditorSaveRecovery } from '@/lib/editor/editor-save-recovery';

const eventId = '11111111-1111-4111-8111-111111111111';

let container: HTMLDivElement;
let root: Root;

function renderEditor() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  root.render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider env="test">
        <ProgramEventEditor
          eventId={eventId}
          currentMemberId="member-1"
          userName="Editor"
          initialTitle="Event"
          initialSlug="event"
          initialSummary={null}
          initialStatus="draft"
          initialSourceLocale="en"
          initialTypeId="type-1"
          initialSeriesId={null}
          initialSeriesOrder={null}
          initialStartsAt={null}
          initialEndsAt={null}
          initialTimezone="UTC"
          initialAllDay={false}
          initialLocationMode="tba"
          initialMapPlaceId={null}
          initialPosterUrl={null}
          initialPosterMedia={[]}
          initialTicketUrl={null}
          initialStreamUrl={null}
          initialExternalUrl={null}
          initialArtists={[{ id: 'artist-old', role: 'performer', sortOrder: 4 }]}
          initialLabels={[{ id: 'label-old', role: 'support', sortOrder: 2 }]}
          initialClients={[{ id: 'client-old', role: 'host', sortOrder: 8 }]}
          initialCredits={[]}
          allowedActions={['edit', 'publish', 'delete']}
          typeOptions={[{ id: 'type-1', name: 'Type' }]}
          seriesOptions={[]}
          canManageTaxonomy={false}
          artistOptions={[{ id: 'artist-next', name: 'Artist' }]}
          labelOptions={[{ id: 'label-next', name: 'Label' }]}
          clientOptions={[{ id: 'client-next', name: 'Client' }]}
          baseUrl="https://example.test"
          canonicalOrigin="https://example.test"
          siteName="Geul"
        />
      </MantineProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateEvent.mockResolvedValue({ success: true });
  mocks.getNeutralConfiguration.mockResolvedValue({
    ok: true,
    configuration: {
      slug: 'event',
      typeId: 'type-1',
      typeName: 'Type',
      seriesId: null,
      seriesOrder: null,
      startsAt: null,
      endsAt: null,
      timezone: 'UTC',
      allDay: false,
      locationMode: 'tba',
      mapPlaceId: null,
      ticketUrl: null,
      streamUrl: null,
      externalUrl: null,
      artists: [{ id: 'artist-old', role: 'performer', sortOrder: 4 }],
      labels: [{ id: 'label-old', role: 'support', sortOrder: 2 }],
      clients: [{ id: 'client-old', role: 'host', sortOrder: 8 }],
    },
  });
  mocks.metadataListener = null;
  mocks.subscribeMetadata.mockImplementation((listener) => {
    mocks.metadataListener = listener;
    return vi.fn();
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  clearEditorSaveRecovery(`program_event:${eventId}`);
  window.sessionStorage.clear();
});

describe('ProgramEventEditor relation saves and navigation', () => {
  it('adopts committed peer title and summary updates from the active room', async () => {
    await act(async () => renderEditor());
    await vi.waitFor(() => expect(mocks.subscribeMetadata).toHaveBeenCalledOnce());

    act(() => {
      mocks.metadataListener?.({
        operation: 'locale',
        values: { title: 'Peer event title', summary: 'Peer event summary' },
        sequence: 1,
      });
    });

    expect(container.querySelector('[data-testid="event-title"]')?.textContent).toBe('Peer event title');
    expect(container.querySelector('[data-testid="event-summary"]')?.textContent).toBe('Peer event summary');
  });

  it('flushes only the edited relation collection before Back', async () => {
    let resolveUpdate: ((result: { success?: boolean }) => void) | undefined;
    mocks.updateEvent.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      }),
    );
    await act(async () => renderEditor());

    act(() => container.querySelector<HTMLButtonElement>('[data-testid="relation-artists"]')?.click());
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="back"]')?.click());
    await vi.waitFor(() =>
      expect(mocks.updateEvent).toHaveBeenCalledWith(eventId, {
        artists: [{ id: 'artists-next', sortOrder: 0 }],
        observed: { artists: [{ id: 'artist-old', role: 'performer', sortOrder: 4 }] },
      }),
    );
    expect(mocks.back).not.toHaveBeenCalled();

    await act(async () => {
      resolveUpdate?.({ success: true });
      await vi.waitFor(() => expect(mocks.back).toHaveBeenCalledOnce());
    });
  });

  it('flushes a queued scalar save before Back waits on its mutation', async () => {
    let resolveUpdate: ((result: { success?: boolean }) => void) | undefined;
    mocks.updateEvent.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      }),
    );
    await act(async () => renderEditor());

    act(() => container.querySelector<HTMLButtonElement>('[data-testid="slug-change"]')?.click());
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="back"]')?.click());
    await vi.waitFor(() => expect(mocks.updateEvent).toHaveBeenCalledWith(eventId, { slug: 'next-slug' }));
    expect(mocks.back).not.toHaveBeenCalled();

    await act(async () => {
      resolveUpdate?.({ success: true });
      await vi.waitFor(() => expect(mocks.back).toHaveBeenCalledOnce());
    });
  });

  it('coalesces relation edits to latest desired values while retaining the first observed baseline', async () => {
    await act(async () => renderEditor());

    act(() => container.querySelector<HTMLButtonElement>('[data-testid="relation-artists"]')?.click());
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="relation-artists-latest"]')?.click());
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="relation-labels"]')?.click());
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="back"]')?.click());

    await vi.waitFor(() => expect(mocks.updateEvent).toHaveBeenCalledOnce());
    expect(mocks.updateEvent).toHaveBeenCalledWith(eventId, {
      artists: [{ id: 'artists-latest', sortOrder: 0 }],
      labels: [{ id: 'labels-next', sortOrder: 0 }],
      observed: {
        artists: [{ id: 'artist-old', role: 'performer', sortOrder: 4 }],
        labels: [{ id: 'label-old', role: 'support', sortOrder: 2 }],
      },
    });
    expect(mocks.back).toHaveBeenCalledOnce();
  });

  it('does not navigate when a pending relation save fails', async () => {
    mocks.updateEvent.mockResolvedValue({ error: 'save failed' });
    await act(async () => renderEditor());

    act(() => container.querySelector<HTMLButtonElement>('[data-testid="relation-labels"]')?.click());
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="back"]')?.click());
    await act(async () => {
      await vi.waitFor(() => expect(mocks.updateEvent).toHaveBeenCalled());
      await vi.waitFor(() => expect(mocks.back).not.toHaveBeenCalled());
    });
    expect(mocks.notification).toHaveBeenCalledWith({ message: 'notifications.saveFailed', color: 'red' });
  });
});
