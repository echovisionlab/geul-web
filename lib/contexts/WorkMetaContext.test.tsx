// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { updateWorkFieldsAction } from '@/lib/actions/work';
import { useWorkMeta, WorkMetaProvider, type WorkMeta } from './WorkMetaContext';

const workId = '11111111-1111-4111-8111-111111111111';
let mockDoc: Y.Doc;
let container: HTMLDivElement;
let root: Root;
let latest: ReturnType<typeof useWorkMeta> | null = null;
const protocol = vi.hoisted(() => ({ updateMetadata: vi.fn(), getSnapshot: vi.fn() }));

vi.mock('@/lib/actions/work', () => ({
  updateWorkFieldsAction: vi.fn().mockResolvedValue({ success: true }),
}));

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

function renderProvider(imageUrl: string | null = null) {
  act(() => {
    root.render(
      <WorkMetaProvider workId={workId} initialMeta={initialMeta} initialFeaturedImageUrl={imageUrl}>
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
    expect(updateWorkFieldsAction).toHaveBeenCalledWith(workId, { clients: ['client-2', 'client-1'] });
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
