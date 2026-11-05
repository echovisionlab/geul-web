import { localRichFormattingEmailDocument } from './email-rich-formatting';
import { create, fromJson } from '@bufbuild/protobuf';
import { QueryClient } from '@tanstack/react-query';
import {
  TranslationLocaleSchema,
  ListEntityTranslationsResponseSchema,
  TranslationEntrySchema,
} from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { hydrateCanonicalBlockRoom } from '@echovisionlab/geul-common/collaboration/block-room-codec';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { createBlockRoomProseMirrorBridge } from '@/features/editor/tiptap/block-room-prosemirror-bridge';
import { createRichTextBlockRoomTiptapController } from '@/features/editor/tiptap/block-room-tiptap-controller';
import type { UseActiveEditLocaleResult } from '@/features/translation/useActiveEditLocale';
export function localEditLocale(locale: string, setActiveLocale: (locale: string) => void): UseActiveEditLocaleResult {
  return {
    isControlVisible: true,
    isLoading: false,
    localeChanging: false,
    isSourceLocaleReady: true,
    activeLocale: locale,
    activeLocaleLabel: locale === 'ko' ? '한국어' : 'English',
    sourceLocale: 'ko',
    sourceLocaleLabel: '한국어',
    localeOptions: [
      { value: 'ko', label: '한국어' },
      { value: 'en', label: 'English' },
    ],
    isSourceLocale: locale === 'ko',
    hasLiveRow: true,
    canEditActiveLocale: true,
    displayTitle: 'Listening room',
    displaySummary: 'October edition',
    displayOgImageUrl: null,
    ogGenerationRun: null,
    contentPreview: '',
    contentPreviewLoading: false,
    setActiveLocale,
  };
}
export const readyQuery = { isError: false, error: null, isFetching: false, refetch: async () => {} };
export function localEditorQueryClient(entityType: string, entityId: string) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, refetchOnWindowFocus: false, refetchOnMount: false },
    },
  });
  client.setQueryData(
    ['translation-locales'],
    [
      create(TranslationLocaleSchema, { code: 'ko', displayName: '한국어', enabled: true }),
      create(TranslationLocaleSchema, { code: 'en', displayName: 'English', enabled: true }),
    ],
  );
  client.setQueryData(
    ['entity-translations', entityType, entityId],
    create(ListEntityTranslationsResponseSchema, {
      sourceLocale: 'ko',
      entries: [
        create(TranslationEntrySchema, { locale: 'ko', title: 'Listening room' }),
        create(TranslationEntrySchema, { locale: 'en', title: 'Listening room' }),
      ],
    }),
  );
  return client;
}
/** Actual canonical email block room and editor bridge; no WebSocket is opened. */
export function localEmailRoom(entityType: 'campaign' | 'email_template', lineBreaks = false, richFormatting = false) {
  const document = new Y.Doc();
  hydrateCanonicalBlockRoom(
    document,
    entityType === 'email_template' ? 'email-template' : entityType,
    'ko',
    richFormatting
      ? localRichFormattingEmailDocument()
      : fromJson(LocalizedRichTextDocumentSchema, {
          blockCatalogFingerprint: contentBlockCatalogFingerprint,
          profile: RichTextProfile.EMAIL,
          locale: 'ko',
          base: {
            nodes: [
              {
                block: { id: '20000000-0000-4000-8000-000000000001', paragraph: { props: {} } },
                placement: { index: 0 },
              },
              ...(lineBreaks
                ? [
                    {
                      block: { id: '20000000-0000-4000-8000-000000000002', paragraph: { props: {} } },
                      placement: { index: 1 },
                    },
                  ]
                : []),
            ],
          },
          localeOverlay: {
            locale: 'ko',
            blocks: [
              {
                blockId: '20000000-0000-4000-8000-000000000001',
                paragraph: {
                  props: {},
                  content: lineBreaks
                    ? [
                        { text: { text: 'First line\nText newline' } },
                        { hardBreak: {} },
                        { text: { text: 'After hard break' } },
                      ]
                    : [{ text: { text: 'Listening room · October edition. Join us for an evening of music.' } }],
                },
              },
              ...(lineBreaks
                ? [
                    {
                      blockId: '20000000-0000-4000-8000-000000000002',
                      paragraph: { props: {}, content: [{ text: { text: 'Second paragraph' } }] },
                    },
                  ]
                : []),
            ],
          },
        }),
    [],
  );
  const awareness = new Awareness(document);
  const bridge = createBlockRoomProseMirrorBridge({
    document,
    documentType: entityType === 'email_template' ? 'email-template' : entityType,
    locale: 'ko',
  });
  const controller = createRichTextBlockRoomTiptapController(bridge);
  return { document, awareness, bridge, controller, provider: { awareness } };
}
