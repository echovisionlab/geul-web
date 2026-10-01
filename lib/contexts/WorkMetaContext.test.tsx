// @vitest-environment jsdom

import { notifications } from '@mantine/notifications';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { updateWorkFieldsAction } from '@/lib/actions/work';
import { publishEditorEntityChange } from '@/lib/editor/editor-entity-changes';
import {
  flushEditorSaves,
  getPendingEditorPatch,
  hasPendingEditorSaves,
  registerEditorSave,
} from '@/lib/editor/editor-save-registry';
import { useWorkMeta, WorkMetaProvider, type WorkMeta } from './WorkMetaContext';

const workId = '11111111-1111-4111-8111-111111111111';
let mockDoc: Y.Doc;
let container: HTMLDivElement;
let root: Root;
let latest: ReturnType<typeof useWorkMeta> | null = null;
const protocol = vi.hoisted(() => ({ updateMetadata: vi.fn(), getSnapshot: vi.fn() }));

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));

vi.mock('@/lib/actions/work', () => ({
  updateWorkFieldsAction: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/editor/editor-entity-changes', () => ({ publishEditorEntityChange: vi.fn() }));

vi.mock('@/lib/collab/useBlockRoomConnection', () => ({
  useBlockRoomConnection: () => ({
    provider: null,
    doc: mockDoc,
    bootstrap: {
      revision: '22222222-2222-4222-8222-222222222222',
      canonicalHash: 'a'.repeat(64),
      blockCatalogFingerprint: 'catalog-v1',
      serverInstanceId: 'server-1',
      roomEpoch: '33333333-3333-4333-8333-333333333333',
      bootstrapChallenge: 'challenge-1',
    },
    protocol,
    isConnected: true,
    isSynced: true,
    isLoading: false,
    error: null,
    acceptEpochAck: vi.fn(),
    reloadCanonical: vi.fn(),
  }),
}));

vi.mock('@/features/translation/useActiveEditLocale', () => ({
  useActiveEditLocale: () => ({
    activeLocale: 'en',
    sourceLocale: 'en',
    isSourceLocale: true,
    isSourceLocaleReady: true,
    hasLiveRow: true,
  }),
}));

const initialMeta: WorkMeta = {
  title: 'Inspire Resort: Le Space',
  slug: 'inspire-resort-le-space',
  type: 'portfolio',
  year: 2026,
  month: 3,
  untilYear: 2026,
  untilMonth: 3,
  isPresent: false,
  summary: 'Directed the immersive audio architecture.',
  metadata: {},
  featured: false,
  creditsVersion: 0,
  creditOrder: [],
  clients: [],
};

function Reader() {
  latest = useWorkMeta();
  return null;
}

function renderProvider(imageUrl: string | null = null, meta: WorkMeta = initialMeta) {
  act(() => {
    root.render(
      <WorkMetaProvider workId={workId} initialMeta={meta} initialFeaturedImageUrl={imageUrl}>
        <Reader />
      </WorkMetaProvider>,
    );
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDoc = new Y.Doc();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  latest = null;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  mockDoc.destroy();
});

describe('WorkMetaProvider', () => {
  it('keeps global fields local while exposing the one resident Block Y.Doc', () => {
    renderProvider('https://example.com/cover.jpg');

    expect(latest?.doc).toBe(mockDoc);
    expect(latest?.title).toBe(initialMeta.title);
    expect(latest?.summary).toBe(initialMeta.summary);
    expect(latest?.featuredImageUrl).toBe('https://example.com/cover.jpg');

    act(() => latest?.setType('article'));
    expect(latest?.type).toBe('article');
  });

  it('persists the ordered client IDs through the owning Manage RPC', async () => {
    renderProvider();

    act(() => latest?.setClients(['client-2', 'client-1']));
    await act(async () => Promise.resolve());

    expect(latest?.clients).toEqual(['client-2', 'client-1']);
    expect(updateWorkFieldsAction).toHaveBeenCalledWith(workId, {
      clients: ['client-2', 'client-1'],
      observedClients: [],
    });
    expect(publishEditorEntityChange).toHaveBeenCalledWith(`work:${workId}`);
  });

  it('adopts refreshed route fields while retaining local credit state', () => {
    renderProvider();
    act(() => {
      latest?.setCreditOrder([{ type: 'group', id: 'group-1' }]);
    });

    const refreshed: WorkMeta = {
      ...initialMeta,
      title: 'Peer title',
      year: 2025,
      metadata: { peerKey: 'peer value' },
      clients: ['peer-client'],
    };
    renderProvider(null, refreshed);

    expect(latest?.title).toBe('Peer title');
    expect(latest?.year).toBe(2025);
    expect(latest?.metadata).toEqual({ peerKey: 'peer value' });
    expect(latest?.clients).toEqual(['peer-client']);
    expect(latest?.creditOrder).toEqual([{ type: 'group', id: 'group-1' }]);
  });

  it('protects locally pending fields while adopting unrelated refreshed fields', () => {
    renderProvider();
    act(() => {
      latest?.setTitle('Local title');
      latest?.setSummary('Local summary');
      latest?.setMetadata({ localKey: 'local draft' });
    });
    const unregister = registerEditorSave(`work:${workId}`, {
      flush: async () => true,
      hasPending: () => true,
      getPendingPatch: () => ({
        sourceTitle: 'Local title',
        summary: 'Local summary',
        metadata: { localKey: 'local draft' },
      }),
    });

    renderProvider(null, {
      ...initialMeta,
      title: 'Peer title',
      summary: 'Peer summary',
      year: 2025,
      metadata: { peerKey: 'peer value' },
      clients: ['peer-client'],
    });

    expect(latest?.metadata).toEqual({ localKey: 'local draft' });
    expect(latest?.title).toBe('Local title');
    expect(latest?.summary).toBe('Local summary');
    expect(latest?.year).toBe(2025);
    expect(latest?.clients).toEqual(['peer-client']);
    unregister();
  });

  it('keeps featured-image presentation ephemeral and rejects stale setters', () => {
    renderProvider();
    const staleSetter = latest?.setFeaturedImage;

    act(() => {
      expect(latest?.setFeaturedImage('file-1', 'https://example.com/cover.jpg')).toBe(true);
    });
    expect(latest?.featuredImageUrl).toBe('https://example.com/cover.jpg');

    act(() => root.render(null));
    expect(staleSetter?.('late-file', 'https://example.com/late.jpg')).toBe(false);
  });
});

describe('client save failures', () => {
  it('retains a failed replacement as pending and lets the save barrier retry it', async () => {
    vi.mocked(updateWorkFieldsAction)
      .mockResolvedValueOnce({ error: 'permission denied' })
      .mockResolvedValueOnce({ success: true, clients: ['unsaved'] });
    renderProvider();
    await act(async () => {
      latest?.setClients(['unsaved']);
    });
    expect(latest?.clients).toEqual(['unsaved']);
    expect(hasPendingEditorSaves(`work:${workId}`)).toBe(true);
    expect(getPendingEditorPatch(`work:${workId}`)).toEqual({ clients: ['unsaved'] });
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'permission denied', color: 'red' }),
    );
    await expect(flushEditorSaves(`work:${workId}`)).resolves.toBe(true);
    expect(latest?.clients).toEqual(['unsaved']);
    expect(hasPendingEditorSaves(`work:${workId}`)).toBe(false);
    expect(updateWorkFieldsAction).toHaveBeenCalledTimes(2);
  });

  it('flushes current and queued client edits before the save barrier resolves', async () => {
    let finishFirst!: (result: { success: boolean; clients: string[] }) => void;
    let finishSecond!: (result: { success: boolean; clients: string[] }) => void;
    vi.mocked(updateWorkFieldsAction)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishSecond = resolve;
          }),
      );
    renderProvider();
    await act(async () => {
      latest?.setClients(['client-one']);
      latest?.setClients(['client-two']);
    });

    let flushed: boolean | undefined;
    const flush = flushEditorSaves(`work:${workId}`).then((result) => {
      flushed = result;
      return result;
    });
    expect(flushed).toBeUndefined();
    expect(hasPendingEditorSaves(`work:${workId}`)).toBe(true);

    await act(async () => {
      finishFirst({ success: true, clients: ['client-one'] });
    });
    expect(updateWorkFieldsAction).toHaveBeenCalledTimes(2);
    expect(flushed).toBeUndefined();

    await act(async () => {
      finishSecond({ success: true, clients: ['client-two'] });
    });
    await expect(flush).resolves.toBe(true);
    expect(latest?.clients).toEqual(['client-two']);
    expect(hasPendingEditorSaves(`work:${workId}`)).toBe(false);
  });
  it('serializes rapid replacements and retains the latest intent when a later save fails', async () => {
    let finishFirst!: (result: { success: boolean; clients: string[] }) => void;
    let finishSecond!: (result: { error: string }) => void;
    vi.mocked(updateWorkFieldsAction)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishSecond = resolve;
          }),
      );
    renderProvider();
    await act(async () => {
      latest?.setClients(['saved']);
      latest?.setClients(['unsaved']);
    });
    renderProvider(null, {
      ...initialMeta,
      year: 2025,
      metadata: { peerKey: 'peer value' },
      clients: ['server-client'],
    });
    expect(updateWorkFieldsAction).toHaveBeenCalledTimes(1);
    expect(latest?.clients).toEqual(['unsaved']);
    expect(latest?.metadata).toEqual({ peerKey: 'peer value' });
    expect(latest?.year).toBe(2025);
    expect(updateWorkFieldsAction).toHaveBeenNthCalledWith(1, workId, {
      clients: ['saved'],
      observedClients: [],
    });
    await act(async () => {
      finishFirst({ success: true, clients: ['saved', 'peer-client'] });
    });
    expect(updateWorkFieldsAction).toHaveBeenCalledTimes(2);
    expect(updateWorkFieldsAction).toHaveBeenNthCalledWith(2, workId, {
      clients: ['peer-client', 'unsaved'],
      observedClients: ['saved', 'peer-client'],
    });
    expect(latest?.clients).toEqual(['unsaved']);
    await act(async () => {
      finishSecond({ error: 'offline' });
    });
    expect(latest?.clients).toEqual(['unsaved']);
    expect(getPendingEditorPatch(`work:${workId}`)).toEqual({ clients: ['unsaved'] });
  });
});
