// @vitest-environment jsdom

import { notifications } from '@/components/core/Notification';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { getWorkConfigurationAction, updateWorkFieldsAction } from '@/lib/actions/work';
import { publishEditorEntityChange } from '@/lib/editor/editor-entity-changes';
import { setProviderAccessLevel } from '@/lib/collab/provider-control-state';
import {
  flushEditorSaves,
  getPendingEditorPatch,
  hasPendingEditorSaves,
  registerEditorSave,
} from '@/lib/editor/editor-save-registry';
import { useWorkMeta, WorkMetaProvider, type WorkMeta, type WorkEditorConfiguration } from './WorkMetaContext';

const workId = '11111111-1111-4111-8111-111111111111';
let mockDoc: Y.Doc;
let container: HTMLDivElement;
let root: Root;
let latest: ReturnType<typeof useWorkMeta> | null = null;
const protocol = vi.hoisted(() => ({ updateMetadata: vi.fn(), getSnapshot: vi.fn() }));
const { provider } = vi.hoisted(() => ({ provider: {} }));

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/components/core/Notification', () => ({ notifications: { show: vi.fn() } }));

vi.mock('@/lib/actions/work', () => ({
  updateWorkFieldsAction: vi.fn().mockResolvedValue({ success: true }),
  getWorkConfigurationAction: vi.fn(),
}));

vi.mock('@/lib/editor/editor-entity-changes', () => ({ publishEditorEntityChange: vi.fn() }));

vi.mock('@/lib/collab/useBlockRoomConnection', () => ({
  useBlockRoomConnection: () => ({
    provider,
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

let serverConfiguration: WorkEditorConfiguration;
function configurationFor(meta: WorkMeta, imageUrl: string | null = null): WorkEditorConfiguration {
  return { ...meta, mapPlaceId: null, featuredImageUrl: imageUrl };
}
function renderProvider(imageUrl: string | null = null, meta: WorkMeta = initialMeta, serverMeta: WorkMeta = meta) {
  serverConfiguration = configurationFor(serverMeta, imageUrl);
  act(() => {
    root.render(
      <WorkMetaProvider workId={workId} initialMeta={meta} initialFeaturedImageUrl={imageUrl}>
        <Reader />
      </WorkMetaProvider>,
    );
  });
}

beforeEach(() => {
  setProviderAccessLevel(provider, 'edit');
  vi.clearAllMocks();
  vi.mocked(getWorkConfigurationAction)
    .mockReset()
    .mockImplementation(async () => ({ data: serverConfiguration }));
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
  it('follows refreshed server permission and room access without replacing its document', async () => {
    setProviderAccessLevel(provider, 'view');
    const render = (canEdit: boolean) =>
      act(() =>
        root.render(
          <WorkMetaProvider workId={workId} initialMeta={initialMeta} initialFeaturedImageUrl={null} canEdit={canEdit}>
            <Reader />
          </WorkMetaProvider>,
        ),
      );
    render(false);
    const document = latest?.doc;
    act(() => latest?.setType('article'));
    expect(latest?.type).toBe('portfolio');
    act(() => setProviderAccessLevel(provider, 'edit'));
    act(() => latest?.setType('article'));
    expect(latest?.type).toBe('portfolio');
    render(true);
    act(() => latest?.setType('article'));
    expect(latest?.type).toBe('article');
    act(() => setProviderAccessLevel(provider, 'view'));
    act(() => {
      latest?.setType('portfolio');
      latest?.setClients(['denied']);
    });
    expect(latest?.type).toBe('article');
    expect(updateWorkFieldsAction).not.toHaveBeenCalled();
    expect(latest?.doc).toBe(document);
    await act(async () => Promise.resolve());
  });

  it('persists the ordered client IDs through the owning Manage RPC', async () => {
    renderProvider();

    act(() => latest?.setClients(['client-2', 'client-1']));
    await act(async () => Promise.resolve());

    expect(latest?.clients).toEqual(['client-2', 'client-1']);
    expect(updateWorkFieldsAction).toHaveBeenCalledWith(
      workId,
      {
        clients: ['client-2', 'client-1'],
        observedClients: [],
      },
      expect.any(String),
    );
    expect(publishEditorEntityChange).toHaveBeenCalledWith(`work:${workId}`, expect.any(String));
  });

  it('reloads neutral route fields through the authorized action while retaining local credit state', async () => {
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
    await act(async () => Promise.resolve());

    expect(latest?.title).toBe('Peer title');
    expect(latest?.year).toBe(2025);
    expect(latest?.metadata).toEqual({ peerKey: 'peer value' });
    expect(latest?.clients).toEqual(['peer-client']);
    expect(latest?.creditOrder).toEqual([{ type: 'group', id: 'group-1' }]);
  });

  it('protects locally pending fields while adopting unrelated refreshed fields', async () => {
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

    await act(async () => Promise.resolve());
    expect(latest?.metadata).toEqual({ localKey: 'local draft' });
    expect(latest?.title).toBe('Local title');
    expect(latest?.summary).toBe('Local summary');
    expect(latest?.year).toBe(2025);
    expect(latest?.clients).toEqual(['peer-client']);
    unregister();
  });

  it('ignores an authorized read started before the latest configuration write acknowledgement', async () => {
    renderProvider();
    let finishRead!: (result: Awaited<ReturnType<typeof getWorkConfigurationAction>>) => void;
    vi.mocked(getWorkConfigurationAction).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRead = resolve;
        }),
    );
    act(() => latest?.setMetadata({ local: 'Edited' }));
    const write = latest!.configuration!.beginWrite(['metadata']);
    let refresh!: Promise<boolean>;
    act(() => {
      refresh = latest!.refreshConfiguration!();
    });
    act(() => write.acknowledge({ metadata: { local: 'Edited', peer: 'Canonical' } }));
    await act(async () => {
      finishRead({ data: configurationFor({ ...initialMeta, metadata: { peer: 'Old read' } }) });
      await expect(refresh).resolves.toBe(false);
    });
    expect(latest?.metadata).toEqual({ local: 'Edited', peer: 'Canonical' });
  });

  it('reloads unsolicited stale route props instead of replacing settled canonical settings', async () => {
    renderProvider();
    act(() => latest?.setMetadata({ local: 'Edited' }));
    const write = latest!.configuration!.beginWrite(['metadata']);
    act(() => write.acknowledge({ metadata: { local: 'Edited', peer: 'Canonical' } }));
    renderProvider(
      null,
      { ...initialMeta, metadata: { peer: 'Stale route props' } },
      {
        ...initialMeta,
        metadata: { local: 'Edited', peer: 'Fresh API' },
      },
    );
    expect(latest?.metadata).toEqual({ local: 'Edited', peer: 'Canonical' });
    await act(async () => Promise.resolve());
    expect(latest?.metadata).toEqual({ local: 'Edited', peer: 'Fresh API' });
    expect(getWorkConfigurationAction).toHaveBeenCalledWith(workId);
  });

  it('keeps the acknowledged client merge baseline while reloading stale route props', async () => {
    vi.mocked(updateWorkFieldsAction)
      .mockResolvedValueOnce({ success: true, clients: ['a', 'b'] })
      .mockResolvedValueOnce({ success: true, clients: ['a'] });
    renderProvider(null, { ...initialMeta, clients: ['a'] });
    await act(async () => latest?.setClients(['a', 'b']));
    renderProvider(null, { ...initialMeta, clients: ['a'] }, { ...initialMeta, clients: ['a', 'b'] });
    expect(latest?.clients).toEqual(['a', 'b']);
    await act(async () => Promise.resolve());

    await act(async () => latest?.setClients(['a']));
    expect(updateWorkFieldsAction).toHaveBeenLastCalledWith(
      workId,
      { clients: ['a'], observedClients: ['a', 'b'] },
      expect.any(String),
    );
    expect(latest?.clients).toEqual(['a']);
  });

  it('retains a newer authorized client baseline when an older save response arrives late', async () => {
    let finishWrite!: (result: Awaited<ReturnType<typeof updateWorkFieldsAction>>) => void;
    vi.mocked(updateWorkFieldsAction).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishWrite = resolve;
        }),
    );
    renderProvider();
    await act(async () => latest?.setClients(['local-a']));
    serverConfiguration = configurationFor({ ...initialMeta, clients: ['peer-b'] });
    await act(async () => {
      await latest?.refreshConfiguration?.();
    });
    expect(latest?.clients).toEqual(['local-a']);
    await act(async () => finishWrite({ success: true, clients: ['local-a'] }));
    expect(latest?.clients).toEqual(['peer-b']);

    await act(async () => latest?.setClients(['peer-b', 'local-c']));
    expect(updateWorkFieldsAction).toHaveBeenLastCalledWith(
      workId,
      { clients: ['peer-b', 'local-c'], observedClients: ['peer-b'] },
      expect.any(String),
    );
  });

  it('shows a newly set featured image and rejects the setter of an unmounted provider', () => {
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
      expect.objectContaining({ message: 'permission denied', tone: 'danger' }),
    );
    await act(async () => {
      await expect(flushEditorSaves(`work:${workId}`)).resolves.toBe(true);
    });
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
      clients: ['server-client'],
    });
    await act(async () => Promise.resolve());
    expect(updateWorkFieldsAction).toHaveBeenCalledTimes(1);
    expect(latest?.clients).toEqual(['unsaved']);
    expect(updateWorkFieldsAction).toHaveBeenNthCalledWith(
      1,
      workId,
      {
        clients: ['saved'],
        observedClients: [],
      },
      expect.any(String),
    );
    await act(async () => {
      finishFirst({ success: true, clients: ['saved', 'peer-client'] });
    });
    expect(updateWorkFieldsAction).toHaveBeenCalledTimes(2);
    expect(updateWorkFieldsAction).toHaveBeenNthCalledWith(
      2,
      workId,
      {
        clients: ['server-client', 'unsaved'],
        observedClients: ['server-client'],
      },
      expect.any(String),
    );
    expect(latest?.clients).toEqual(['unsaved']);
    await act(async () => {
      finishSecond({ error: 'offline' });
    });
    expect(latest?.clients).toEqual(['unsaved']);
    expect(getPendingEditorPatch(`work:${workId}`)).toEqual({ clients: ['unsaved'] });
  });
});
