import { encodeMessage, parseClientMessage } from '@echovisionlab/geul-common/collaboration/protocol';
import { fromJson } from '@bufbuild/protobuf';
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedPageDocumentSchema,
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { hydrateCanonicalBlockRoom } from '@echovisionlab/geul-common/collaboration/block-room-codec';
import * as Y from 'yjs';
import { createBlockRoomProseMirrorBridge } from '@/features/editor/tiptap/block-room-prosemirror-bridge';
import { createPostBlockRoomTiptapController } from '@/features/editor/tiptap/block-room-tiptap-controller';
import {
  captureBlockRoomDurabilityState,
  mergeBlockRoomDurabilityStates,
  type BlockRoomDurabilityProtocol,
  type BlockRoomDurabilityState,
} from '@/lib/collab/block-room-durability';
import { createBlockRoomPageSectionsController } from '@/features/page/PageEditor/block-room-page-sections';
import { createDefaultSection } from '@/features/page/PageEditor/types';

/** Production codec/controller/provider with a disconnected transport. All acknowledgements stay in memory. */
class LocalProvider extends HocuspocusProvider {
  acknowledgePersist(requestId: string) {
    this.emit('stateless', {
      payload: encodeMessage({
        kind: 'room.flush_result',
        requestId,
        ok: true,
        persisted: {
          stateVector: btoa(String.fromCharCode(...Y.encodeStateVector(this.document))),
          deleted: Object.fromEntries(Y.decodeUpdate(Y.encodeStateAsUpdate(this.document)).ds.clients),
        },
      }),
    });
  }
}
export function localDocumentRoom(
  entity:
    'post' | 'work' | 'artist' | 'release' | 'program-event' | 'page' | 'label' | 'terms-history' | 'privacy-history',
  locale: string,
) {
  const document = new Y.Doc();
  const blockId = '30000000-0000-4000-8000-000000000001';
  hydrateCanonicalBlockRoom(
    document,
    entity,
    locale,
    entity === 'page'
      ? fromJson(LocalizedPageDocumentSchema, {
          blockCatalogFingerprint: contentBlockCatalogFingerprint,
          locale,
          base: { nodes: [] },
          localeOverlay: { locale, sections: [] },
        })
      : fromJson(LocalizedRichTextDocumentSchema, {
          blockCatalogFingerprint: contentBlockCatalogFingerprint,
          profile:
            entity === 'work'
              ? RichTextProfile.WORK
              : entity === 'program-event'
                ? RichTextProfile.PROGRAM_EVENT
                : entity === 'artist' || entity === 'label' || entity === 'release'
                  ? RichTextProfile.COMPACT
                  : entity.endsWith('-history')
                    ? RichTextProfile.POLICY
                    : RichTextProfile.POST,
          locale,
          base: { nodes: [{ block: { id: blockId, paragraph: { props: {} } }, placement: { index: 0 } }] },
          localeOverlay: {
            locale,
            blocks: [
              {
                blockId,
                paragraph: {
                  props: {},
                  content: [
                    {
                      text: {
                        text:
                          locale === 'ko'
                            ? '본문을 직접 편집해 보세요. 이 문서는 스토리북 안에서만 유지됩니다.'
                            : 'Edit this document. Changes stay inside this Storybook preview.',
                      },
                    },
                  ],
                },
              },
            ],
          },
        }),
    [],
  );
  if (entity === 'page') {
    const sections = createBlockRoomPageSectionsController(document, locale);
    sections.insert(createDefaultSection('rich-text'), { index: 0 });
  }
  const websocket = new HocuspocusProviderWebsocket({ url: 'ws://localhost/storybook-local-room', autoConnect: false });
  const provider = new LocalProvider({
    websocketProvider: websocket,
    name: `storybook:${entity}:${locale}`,
    document,
    flushDelay: 50,
  });
  const listeners = new Set<(state: BlockRoomDurabilityState) => void>();
  let disposed = false;
  let persisted: BlockRoomDurabilityState = { stateVector: Y.encodeStateVector(document), deleted: {} };
  const acknowledge = () => {
    if (disposed) {
      return;
    }
    while (!disposed && provider.hasUnsyncedChanges) {
      provider.decrementUnsyncedChanges();
    }
  };
  provider.forceSync = acknowledge;
  provider.sendStateless = (payload) => {
    if (disposed) {
      return;
    }
    const parsed = parseClientMessage(payload);
    if (parsed.ok && parsed.message.kind === 'room.flush') {
      const request = parsed.message;
      queueMicrotask(() => {
        if (disposed) {
          return;
        }
        acknowledge();
        if (disposed) {
          return;
        }
        provider.acknowledgePersist(request.requestId);
        for (const listener of listeners) {
          if (disposed) {
            break;
          }
          listener(persisted);
        }
      });
    }
  };
  const afterTransaction = (transaction: Y.Transaction) => {
    if (disposed) {
      return;
    }
    const next = captureBlockRoomDurabilityState(document, transaction);
    persisted = mergeBlockRoomDurabilityStates(persisted, next);
    queueMicrotask(acknowledge);
  };
  document.on('afterTransaction', afterTransaction);
  const protocol: BlockRoomDurabilityProtocol = {
    subscribePersisted(listener) {
      if (disposed) {
        return () => {};
      }
      listeners.add(listener);
      listener(persisted);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  const bridge =
    entity === 'page' ? null : createBlockRoomProseMirrorBridge({ document, documentType: entity, locale });
  const controller = bridge ? createPostBlockRoomTiptapController(bridge) : null;
  acknowledge();
  return {
    document,
    provider,
    protocol,
    controller,
    destroy() {
      if (disposed) {
        return;
      }
      disposed = true;
      document.off('afterTransaction', afterTransaction);
      listeners.clear();
      provider.destroy();
      websocket.destroy();
      document.destroy();
    },
  };
}
