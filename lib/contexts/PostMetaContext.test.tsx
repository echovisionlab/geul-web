// @vitest-environment jsdom

import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import type { PostMeta } from '@/lib/collab/post-meta';
import { updatePostBlockRoomDocumentMetadata } from '@/lib/collab/block-room-metadata';
import { PostMetaProvider, usePostMeta } from './PostMetaContext';

const postId = '11111111-1111-4111-8111-111111111111';
let mockDoc: Y.Doc;
let container: HTMLDivElement;
let root: Root;
let latest: ReturnType<typeof usePostMeta> | null = null;
const acceptEpochAck = vi.fn();
const reloadCanonical = vi.fn();
const protocol = vi.hoisted(() => ({ updateMetadata: vi.fn(), getSnapshot: vi.fn() }));
const localeRoom = vi.hoisted(() => ({
  active: {
    activeLocale: 'ko',
    sourceLocale: 'ko',
    isSourceLocale: true,
    isSourceLocaleReady: true,
    hasLiveRow: true,
  },
  connect: vi.fn(),
}));

vi.mock('@/lib/collab/useBlockRoomConnection', () => ({
  useBlockRoomConnection: (...args: unknown[]) => {
    localeRoom.connect(...args);
    return {
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
      acceptEpochAck,
      reloadCanonical,
    };
  },
}));

vi.mock('@/features/translation/useActiveEditLocale', () => ({
  useActiveEditLocale: () => localeRoom.active,
}));

vi.mock('@/lib/collab/block-room-metadata', () => ({
  BlockRoomMetadataError: class BlockRoomMetadataError extends Error {},
  updatePostBlockRoomDocumentMetadata: vi.fn().mockResolvedValue({
    revision: '44444444-4444-4444-8444-444444444444',
    canonicalHash: 'a'.repeat(64),
    blockCatalogFingerprint: 'catalog-v1',
    serverInstanceId: 'server-1',
    roomEpoch: '33333333-3333-4333-8333-333333333333',
    changed: true,
  }),
}));

function Reader() {
  latest = usePostMeta();
  return null;
}

const initialMeta: PostMeta = {
  title: 'Localized title',
  summary: 'Summary',
  categories: [{ id: 'category-1', name: 'Category', slug: 'category' }],
  tags: [{ id: 'tag-1', name: 'Tag', slug: 'tag' }],
  commentsEnabled: true,
  contentHeight: 'content',
  pageChrome: 'flow',
  footer: 'pinned',
};

async function renderProvider(strict = false) {
  const provider = (
    <PostMetaProvider
      postId={postId}
      initialMeta={initialMeta}
      initialSlug="post"
      initialFeaturedImageUrl="https://example.com/hydrated-cover.jpg"
    >
      <Reader />
    </PostMetaProvider>
  );
  await act(async () => {
    root.render(strict ? <StrictMode>{provider}</StrictMode> : provider);
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mockDoc = new Y.Doc();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  latest = null;
  localeRoom.active = {
    activeLocale: 'ko',
    sourceLocale: 'ko',
    isSourceLocale: true,
    isSourceLocaleReady: true,
    hasLiveRow: true,
  };
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  mockDoc.destroy();
  vi.useRealTimers();
});

describe('PostMetaProvider', () => {
  it('selects the exact source or existing target room and keeps a missing target on source fallback', async () => {
    await renderProvider();
    expect(localeRoom.connect).toHaveBeenLastCalledWith('post', postId, 'ko');

    localeRoom.active = {
      activeLocale: 'en',
      sourceLocale: 'ko',
      isSourceLocale: false,
      isSourceLocaleReady: true,
      hasLiveRow: true,
    };
    await renderProvider();
    expect(localeRoom.connect).toHaveBeenLastCalledWith('post', postId, 'en');
    expect(latest?.roomLocale).toBe('en');

    localeRoom.active = { ...localeRoom.active, activeLocale: 'ja', hasLiveRow: false };
    await renderProvider();
    expect(localeRoom.connect).toHaveBeenLastCalledWith('post', postId, 'ko');
    expect(latest?.roomLocale).toBe('ko');
  });

  it('uses one resident Block Y.Doc and batches taxonomy metadata through CAS', async () => {
    await renderProvider();
    expect(latest?.doc).toBe(mockDoc);
    expect(latest?.categoryIds).toEqual(['category-1']);
    expect(latest?.tagIds).toEqual(['tag-1']);

    act(() => {
      latest?.setCategoryIds(['category-2']);
      latest?.setTagIds(['tag-2']);
      vi.advanceTimersByTime(250);
    });
    await act(async () => Promise.resolve());

    expect(updatePostBlockRoomDocumentMetadata).toHaveBeenCalledOnce();
    expect(updatePostBlockRoomDocumentMetadata).toHaveBeenCalledWith(protocol, {
      categoryIds: ['category-2'],
      tagIds: ['tag-2'],
    });
    expect(acceptEpochAck).toHaveBeenCalledOnce();
    expect(mockDoc.getMap('post-meta').size).toBe(0);
  });

  it('keeps non-Block presentation state local and survives StrictMode replay', async () => {
    await renderProvider(true);
    let updated = false;
    act(() => {
      latest?.setLayout({ contentHeight: 'viewport', pageChrome: 'pinned', footer: 'flow' });
      updated = latest?.setFeaturedImage('file-1', 'https://example.com/new-cover.jpg') ?? false;
    });
    expect(updated).toBe(true);
    expect(latest?.featuredImageUrl).toBe('https://example.com/new-cover.jpg');
    expect(latest?.layout).toEqual({ contentHeight: 'viewport', pageChrome: 'pinned', footer: 'flow' });
  });

  it('rejects a stale presentation setter after unmount', async () => {
    await renderProvider();
    const staleSetFeaturedImage = latest?.setFeaturedImage;
    act(() => root.render(null));
    expect(staleSetFeaturedImage?.('late', 'https://example.com/late.jpg')).toBe(false);
  });
});
