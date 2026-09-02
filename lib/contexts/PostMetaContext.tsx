'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import type * as Y from 'yjs';
import type { DocumentLayout } from '@echovisionlab/geul-common/collaboration/document-layout';
import { useDebouncedCallback } from '@mantine/hooks';
import type { PostMeta } from '@/lib/collab/post-meta';
import { useLocaleDocumentSession, type LocaleDocumentSession } from '@/features/translation/useLocaleDocumentSession';
import { BlockRoomMetadataError, updatePostBlockRoomDocumentMetadata } from '@/lib/collab/block-room-metadata';
import { useBlockRoomConnection, type BlockRoomConnection } from '@/lib/collab/useBlockRoomConnection';

interface PostMetaContextValue {
  slug: string | null;
  categoryIds: string[];
  tagIds: string[];
  commentsEnabled: boolean;
  featuredImageUrl: string | null;
  setSlug: (slug: string | null) => void;
  setFeaturedImage: (fileId: string | null, url: string | null) => boolean;
  setCategoryIds: (categoryIds: string[]) => void;
  setTagIds: (tagIds: string[]) => void;
  setCommentsEnabled: (enabled: boolean) => void;
  layout: DocumentLayout;
  setLayout: (layout: DocumentLayout) => void;

  provider: HocuspocusProvider | null;
  doc: Y.Doc | null;
  isConnected: boolean;
  isSynced: boolean;
  bootstrap: BlockRoomConnection['bootstrap'];
  protocol: BlockRoomConnection['protocol'];
  acceptEpochAck: BlockRoomConnection['acceptEpochAck'];
  reloadCanonical: BlockRoomConnection['reloadCanonical'];
  roomLocale: string | null;
  localeSession: LocaleDocumentSession;
}

const PostMetaContext = createContext<PostMetaContextValue | null>(null);
interface PostMetaProviderProps {
  postId: string;
  initialMeta: PostMeta;
  initialSlug: string | null;
  initialFeaturedImageUrl: string | null;
  children: ReactNode;
}

export function PostMetaProvider({
  postId,
  initialMeta,
  initialSlug,
  initialFeaturedImageUrl,
  children,
}: PostMetaProviderProps) {
  const [slug, setSlug] = useState(initialSlug);
  const [commentsEnabled, setCommentsEnabled] = useState(initialMeta.commentsEnabled);
  const [categoryIds, setCategoryIdsState] = useState(initialMeta.categories.map((category) => category.id));
  const [tagIds, setTagIdsState] = useState(initialMeta.tags.map((tag) => tag.id));
  const [layout, setLayout] = useState<DocumentLayout>({
    contentHeight: initialMeta.contentHeight,
    pageChrome: initialMeta.pageChrome,
    footer: initialMeta.footer,
  });
  const [featuredImageUrl, setFeaturedImageUrl] = useState(initialFeaturedImageUrl);
  const aliveRef = useRef(false);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, [postId]);

  const localeSession = useLocaleDocumentSession({
    entityType: 'post',
    entityId: postId,
    sourceTitle: initialMeta.title,
    sourceSummary: initialMeta.summary,
  });
  const { roomLocale } = localeSession;
  const blockRoom = useBlockRoomConnection('post', postId, roomLocale);
  const { provider, doc, isConnected, isSynced, bootstrap, protocol, acceptEpochAck, reloadCanonical } = blockRoom;
  const pendingDocumentMetadataRef = useRef<{
    categoryIds?: readonly string[];
    tagIds?: readonly string[];
  }>({});
  const persistDocumentMetadata = useDebouncedCallback(async () => {
    const update = pendingDocumentMetadataRef.current;
    pendingDocumentMetadataRef.current = {};
    if (!bootstrap || !protocol || (!update.categoryIds && !update.tagIds)) {
      return;
    }
    try {
      const ack = await updatePostBlockRoomDocumentMetadata(protocol, update);
      acceptEpochAck(ack);
    } catch (error) {
      if (error instanceof BlockRoomMetadataError && error.reloadRequired) {
        reloadCanonical();
      }
    }
  }, 250);
  const setCategoryIds = useCallback(
    (next: string[]) => {
      setCategoryIdsState(next);
      pendingDocumentMetadataRef.current = {
        ...pendingDocumentMetadataRef.current,
        categoryIds: next,
      };
      persistDocumentMetadata();
    },
    [persistDocumentMetadata],
  );
  const setTagIds = useCallback(
    (next: string[]) => {
      setTagIdsState(next);
      pendingDocumentMetadataRef.current = {
        ...pendingDocumentMetadataRef.current,
        tagIds: next,
      };
      persistDocumentMetadata();
    },
    [persistDocumentMetadata],
  );
  const setFeaturedImage = useCallback((_fileId: string | null, url: string | null) => {
    if (!aliveRef.current) {
      return false;
    }
    setFeaturedImageUrl(url);
    return true;
  }, []);

  const contextValue = useMemo<PostMetaContextValue>(
    () => ({
      slug,
      categoryIds,
      tagIds,
      commentsEnabled,
      featuredImageUrl,
      setSlug,
      setFeaturedImage,
      setCategoryIds,
      setTagIds,
      setCommentsEnabled,
      layout,
      setLayout,
      provider,
      doc,
      isConnected,
      isSynced,
      bootstrap,
      protocol,
      acceptEpochAck,
      reloadCanonical,
      roomLocale,
      localeSession,
    }),
    [
      slug,
      categoryIds,
      tagIds,
      commentsEnabled,
      featuredImageUrl,
      setFeaturedImage,
      setCategoryIds,
      setTagIds,
      layout,
      provider,
      doc,
      isConnected,
      isSynced,
      bootstrap,
      protocol,
      acceptEpochAck,
      reloadCanonical,
      roomLocale,
      localeSession,
    ],
  );

  return <PostMetaContext.Provider value={contextValue}>{children}</PostMetaContext.Provider>;
}

export function usePostMeta(): PostMetaContextValue {
  const context = useContext(PostMetaContext);
  if (!context) {
    throw new Error('usePostMeta must be used within a PostMetaProvider');
  }
  return context;
}

// Re-export types for consumers
export type { PostMeta, Category, Tag } from '@/lib/collab/post-meta';
