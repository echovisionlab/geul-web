'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import type * as Y from 'yjs';
import type { DocumentLayout } from '@echovisionlab/geul-common/collaboration/document-layout';
import type { PostMeta } from '@/lib/collab/post-meta';
import { useLocaleDocumentSession, type LocaleDocumentSession } from '@/features/translation/useLocaleDocumentSession';
import { updatePostBlockRoomDocumentMetadata, type PostTaxonomyMetadataPatch } from '@/lib/collab/block-room-metadata';
import { useBlockRoomConnection, type BlockRoomConnection } from '@/lib/collab/useBlockRoomConnection';
import { useBlockRoomMetadataUpdates } from '@/lib/editor/useBlockRoomMetadataUpdates';
import { useDebouncedRoomMetadata } from '@/lib/editor/useDebouncedRoomMetadata';

interface PostMetaContextValue {
  sourceTitle: string;
  sourceSummary: string;
  setSourceTitle: (title: string) => void;
  setSourceSummary: (summary: string) => void;
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
  recoverySnapshot: BlockRoomConnection['recoverySnapshot'];
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
  const [sourceTitle, setSourceTitle] = useState(initialMeta.title);
  const [sourceSummary, setSourceSummary] = useState(initialMeta.summary);
  const [commentsEnabled, setCommentsEnabled] = useState(initialMeta.commentsEnabled);
  const [categoryIds, setCategoryIdsState] = useState(initialMeta.categories.map((category) => category.id));
  const [tagIds, setTagIdsState] = useState(initialMeta.tags.map((tag) => tag.id));
  const categoryIdsRef = useRef(categoryIds);
  const tagIdsRef = useRef(tagIds);
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
    sourceTitle,
    sourceSummary,
  });
  const { roomLocale } = localeSession;
  const blockRoom = useBlockRoomConnection('post', postId, roomLocale);
  const {
    provider,
    doc,
    isConnected,
    isSynced,
    bootstrap,
    protocol,
    acceptEpochAck,
    reloadCanonical,
    recoverySnapshot,
  } = blockRoom;
  const persistDocumentMetadata = useDebouncedRoomMetadata({
    operation: 'document',
    connection: blockRoom,
    document: `post:${postId}`,
    delay: 250,
    write: (protocol, update: PostTaxonomyMetadataPatch) => updatePostBlockRoomDocumentMetadata(protocol, update),
  });
  const setCategoryIds = useCallback(
    (next: string[]) => {
      const observed = categoryIdsRef.current;
      categoryIdsRef.current = next;
      setCategoryIdsState(next);
      persistDocumentMetadata({ categoryIds: next, observed: { categoryIds: observed } });
    },
    [persistDocumentMetadata],
  );
  const setTagIds = useCallback(
    (next: string[]) => {
      const observed = tagIdsRef.current;
      tagIdsRef.current = next;
      setTagIdsState(next);
      persistDocumentMetadata({ tagIds: next, observed: { tagIds: observed } });
    },
    [persistDocumentMetadata],
  );
  useBlockRoomMetadataUpdates(blockRoom, `post:${postId}`, ({ operation, values }) => {
    if (operation !== 'document') {
      return;
    }
    if (Array.isArray(values.categoryIds) && values.categoryIds.every((id): id is string => typeof id === 'string')) {
      const categoryIds = [...values.categoryIds];
      categoryIdsRef.current = categoryIds;
      setCategoryIdsState(categoryIds);
    }
    if (Array.isArray(values.tagIds) && values.tagIds.every((id): id is string => typeof id === 'string')) {
      const tagIds = [...values.tagIds];
      tagIdsRef.current = tagIds;
      setTagIdsState(tagIds);
    }
  });
  const setFeaturedImage = useCallback((_fileId: string | null, url: string | null) => {
    if (!aliveRef.current) {
      return false;
    }
    setFeaturedImageUrl(url);
    return true;
  }, []);

  const contextValue = useMemo<PostMetaContextValue>(
    () => ({
      sourceTitle,
      sourceSummary,
      setSourceTitle,
      setSourceSummary,
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
      recoverySnapshot,
      roomLocale,
      localeSession,
    }),
    [
      sourceTitle,
      sourceSummary,
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
      recoverySnapshot,
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
