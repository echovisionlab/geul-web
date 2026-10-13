import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { DocumentLayout } from '@echovisionlab/geul-common/collaboration/document-layout';
import { createLocalOgPreview } from './local-og-preview';
import { localDocumentRoom } from './document-editor-room';
import { localEditorQueryClient, localEditLocale } from './editor-pages';

export type EditorPreviewState = 'ready' | 'disconnected' | 'readonly';
export const noop = () => {};
export const pending = { isPending: false };
export const mutation = { ...pending, mutate: noop };
export const ogImage = {
  src: undefined,
  isRegenerating: false,
  status: undefined,
  error: undefined,
  targetKey: 'local-og',
  trackLatest: async () => true,
};
export function useDocumentEditor(entity: Parameters<typeof localDocumentRoom>[0], state: EditorPreviewState) {
  const [locale, setLocale] = useState('ko');
  const [deleted, setDeleted] = useState(false);
  const [ogSrc, setOgSrc] = useState<string | undefined>();
  const [room, setRoom] = useState<ReturnType<typeof localDocumentRoom> | null>(null);
  const [rooms] = useState(() => new Map<string, ReturnType<typeof localDocumentRoom>>());
  const [client] = useState(() => {
    const client = localEditorQueryClient(
      entity === 'program-event' ? 'program_event' : entity.replace('-history', ''),
      `local-${entity}`,
    );
    client.setQueryData(['work', 'groupsWithCredits', `local-${entity}`], { groups: [], credits: [], order: [] });
    client.setQueryData(['mapPlace', 'search', ''], []);
    client.setQueryData(['shareLinks', entity.replace('-history', ''), `local-${entity}`], []);
    return client;
  });
  useEffect(() => {
    const key = `${entity}:${locale}`;
    let value = rooms.get(key);
    if (!value) {
      value = localDocumentRoom(entity, locale);
      rooms.set(key, value);
    }
    setRoom(value);
  }, [entity, locale, rooms]);
  useEffect(
    () => () => {
      rooms.forEach((value) => value.destroy());
      rooms.clear();
    },
    [rooms],
  );
  const [title, setTitle] = useState('밤의 기록'),
    [summary, setSummary] = useState('음악과 공간에 관한 이야기'),
    [slug, setSlug] = useState('night-signals');
  const [layout, setLayout] = useState<DocumentLayout>({
    contentHeight: 'content',
    pageChrome: 'flow',
    footer: 'flow',
  });
  const [featuredImageUrl, setFeaturedImageUrl] = useState<string | null>(null);
  const [versionsOpened, setVersionsOpened] = useState(false),
    [createPlaceOpened, setCreatePlaceOpened] = useState(false);
  const router = useRouter(),
    tCommon = useTranslations('common'),
    tCommonLabels = useTranslations('common.labels'),
    tLayout = useTranslations('contentLayout');
  const connected = state !== 'disconnected',
    canEdit = state === 'ready';
  const activeEditLocale = {
    ...localEditLocale(locale, setLocale),
    displayTitle: title,
    displaySummary: summary,
    canEditActiveLocale: canEdit,
  };
  return {
    room,
    deleted,
    deleteMutation: { isPending: false, mutate: () => setDeleted(true) },
    remove: async () => setDeleted(true),
    ogImage: { ...ogImage, src: ogSrc, status: ogSrc ? ('ready' as const) : undefined },
    regenerateOgImage: { isPending: false, mutate: () => setOgSrc(createLocalOgPreview(title, summary)) },
    client,
    locale,
    setLocale,
    title,
    setTitle,
    summary,
    setSummary,
    slug,
    setSlug,
    layout,
    setLayout,
    featuredImageUrl,
    setFeaturedImageUrl,
    versionsOpened,
    setVersionsOpened,
    createPlaceOpened,
    setCreatePlaceOpened,
    router,
    tCommon,
    tCommonLabels,
    tLayout,
    connected,
    canEdit,
    activeEditLocale,
    slugMgmt: { isAvailable: true, error: undefined, isChecking: false, handleChange: setSlug, handleBlur: noop },
    localeSession: {
      activeEditLocale,
      roomLocale: locale,
      mode: { isEditingScopedLocale: locale !== 'ko', hasScopedLocaleLiveRow: true, shouldUseLocaleDocument: true },
      hasRoomMutationAuthority: () => canEdit,
    },
    session: room?.controller ? { provider: room.provider, controller: room.controller } : null,
    site: { baseUrl: 'https://studio.example.com', canonicalOrigin: 'https://studio.example.com', siteName: 'Studio' },
    identity: { currentMemberId: 'local-member', userName: 'Storybook Editor' },
    connection: {
      provider: room?.provider ?? null,
      doc: room?.document ?? null,
      isConnected: connected,
      isSynced: connected,
      bootstrap: null,
      protocol: null,
      acceptEpochAck: () => true,
      reloadCanonical: noop,
      recoverySnapshot: null,
      roomLocale: locale,
    },
  };
}
