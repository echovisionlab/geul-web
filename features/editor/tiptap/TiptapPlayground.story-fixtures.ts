import { fromJson } from '@bufbuild/protobuf';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { hydrateCanonicalBlockRoom } from '@echovisionlab/geul-common/collaboration/block-room-codec';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { createBlockRoomProseMirrorBridge } from './block-room-prosemirror-bridge';
import { createPostBlockRoomTiptapController } from './block-room-tiptap-controller';

export const PLAYGROUND_MERMAID_ID = '10000000-0000-4000-8000-000000000102';
export const PLAYGROUND_MERMAID_SOURCE =
  'flowchart LR\n  Draft[초안] --> Review{검토}\n  Review -->|승인| Publish[발행]\n  Review -->|수정| Draft';

export function createTiptapPlaygroundRoom() {
  const headingId = '10000000-0000-4000-8000-000000000100';
  const paragraphId = '10000000-0000-4000-8000-000000000101';
  const lastId = '10000000-0000-4000-8000-000000000103';
  const document = new Y.Doc();
  hydrateCanonicalBlockRoom(
    document,
    'post',
    'ko',
    fromJson(LocalizedRichTextDocumentSchema, {
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      profile: RichTextProfile.POST,
      locale: 'ko',
      base: {
        nodes: [
          { block: { id: headingId, heading: { props: { level: 2 } } }, placement: { index: 0 } },
          { block: { id: paragraphId, paragraph: { props: {} } }, placement: { index: 1 } },
          {
            block: { id: PLAYGROUND_MERMAID_ID, mermaid: { props: { source: PLAYGROUND_MERMAID_SOURCE } } },
            placement: { index: 2 },
          },
          { block: { id: lastId, paragraph: { props: {} } }, placement: { index: 3 } },
        ],
      },
      localeOverlay: {
        locale: 'ko',
        blocks: [
          { blockId: headingId, heading: { props: {}, content: [{ text: { text: '문서 작업 흐름' } }] } },
          {
            blockId: paragraphId,
            paragraph: { props: {}, content: [{ text: { text: '초안을 검토하고 승인된 문서를 발행합니다.' } }] },
          },
          { blockId: PLAYGROUND_MERMAID_ID, mermaid: { props: { title: '' } } },
          { blockId: lastId, paragraph: { props: {}, content: [] } },
        ],
      },
    }),
    [],
  );
  const awareness = new Awareness(document);
  const bridge = createBlockRoomProseMirrorBridge({ document, documentType: 'post', locale: 'ko' });
  const controller = createPostBlockRoomTiptapController(bridge);
  return { document, awareness, bridge, controller };
}
