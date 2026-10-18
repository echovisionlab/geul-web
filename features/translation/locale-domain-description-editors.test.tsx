// @vitest-environment jsdom
// @geul-test-tier editor-integration

import type { ComponentType } from 'react';
import type { Editor } from '@tiptap/core';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fromJson, type JsonValue } from '@bufbuild/protobuf';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { hydrateCanonicalBlockRoom } from '@echovisionlab/geul-common/collaboration/block-room-codec';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { act, render } from '@/test/render';
import { ArtistBioEditor } from '@/features/artist/ArtistEditor/ArtistBioEditor';
import { LabelDescriptionEditor } from '@/features/label/LabelEditor/LabelDescriptionEditor';
import { ReleaseDescriptionEditor } from '@/features/release/ReleaseEditor/ReleaseDescriptionEditor';
import { createBlockRoomProseMirrorBridge } from '@/features/editor/tiptap/block-room-prosemirror-bridge';
import {
  createRichTextBlockRoomTiptapController,
  type RichTextBlockRoomTiptapController,
} from '@/features/editor/tiptap/block-room-tiptap-controller';

const PARAGRAPH_ID = '10000000-0000-4000-8000-000000000011';
const INSERTED_ID = '10000000-0000-4000-8000-000000000012';

interface DescriptionEditorProps {
  provider: HocuspocusProvider;
  blockRoomController: RichTextBlockRoomTiptapController;
  structureLocked?: boolean;
}

function ArtistBio(props: DescriptionEditorProps) {
  return <ArtistBioEditor artistId="artist-1" {...props} />;
}

function LabelDescription(props: DescriptionEditorProps) {
  return <LabelDescriptionEditor labelId="label-1" {...props} />;
}

function ReleaseDescription(props: DescriptionEditorProps) {
  return <ReleaseDescriptionEditor releaseId="release-1" {...props} />;
}

const descriptionEditors: Array<[string, 'artist' | 'label' | 'release', ComponentType<DescriptionEditorProps>]> = [
  ['Artist bio', 'artist', ArtistBio],
  ['Label description', 'label', LabelDescription],
  ['Release description', 'release', ReleaseDescription],
];

let yDocument: Y.Doc | null = null;
let awareness: Awareness | null = null;
let unmount: (() => void) | null = null;
let mounted: Editor | null = null;
let queryClient: QueryClient | null = null;

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(async () => {
  try {
    unmount?.();
    // Tiptap defers destruction; the collaboration resources must outlive it.
    await vi.waitFor(() => expect(mounted?.isDestroyed ?? true).toBe(true));
  } finally {
    queryClient?.clear();
    awareness?.destroy();
    yDocument?.destroy();
    queryClient = null;
    awareness = null;
    yDocument = null;
    unmount = null;
    mounted = null;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  }
});

/** Mounts a description editor on an in-memory target-locale room holding one paragraph. */
async function mountDescription(
  documentType: 'artist' | 'label' | 'release',
  DescriptionEditor: ComponentType<DescriptionEditorProps>,
  structureLocked: boolean,
): Promise<Editor> {
  yDocument = new Y.Doc();
  awareness = new Awareness(yDocument);
  hydrateCanonicalBlockRoom(
    yDocument,
    documentType,
    'en',
    fromJson(LocalizedRichTextDocumentSchema, {
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      profile: RichTextProfile.COMPACT,
      locale: 'en',
      base: { nodes: [{ block: { id: PARAGRAPH_ID, paragraph: { props: {} } }, placement: { index: 0 } }] },
      localeOverlay: {
        locale: 'en',
        blocks: [{ blockId: PARAGRAPH_ID, paragraph: { props: {}, content: [{ text: { text: 'Original text' } }] } }],
      },
    } as JsonValue),
    [],
  );
  const controller = createRichTextBlockRoomTiptapController(
    createBlockRoomProseMirrorBridge({ document: yDocument, documentType, locale: 'en' }),
  );
  const connect = controller.connect.bind(controller);
  vi.spyOn(controller, 'connect').mockImplementation((editor) => {
    mounted = editor;
    return connect(editor);
  });
  queryClient = new QueryClient();
  ({ unmount } = render(
    <QueryClientProvider client={queryClient}>
      <DescriptionEditor
        provider={{ awareness } as unknown as HocuspocusProvider}
        blockRoomController={controller}
        structureLocked={structureLocked}
      />
    </QueryClientProvider>,
  ));
  await vi.waitFor(() => expect(mounted).not.toBeNull());
  return mounted!;
}

async function insertBlock(editor: Editor) {
  await act(async () =>
    editor.view.dispatch(
      editor.state.tr.insert(
        1,
        editor.schema.nodes.blockContainer.create({ id: INSERTED_ID }, editor.schema.nodes.paragraph.create()),
      ),
    ),
  );
}

describe('target-locale description editors', () => {
  it.each(descriptionEditors)(
    '%s rejects block structure changes in a target locale while text edits apply',
    async (_editor, documentType, DescriptionEditor) => {
      const editor = await mountDescription(documentType, DescriptionEditor, true);
      const before = editor.state.doc;

      await insertBlock(editor);
      expect(editor.state.doc.eq(before)).toBe(true);

      await act(async () => {
        editor.commands.setTextSelection(4);
        editor.commands.insertContent('!');
      });
      expect(editor.getText()).toContain('!');
    },
  );

  it.each(descriptionEditors)(
    '%s accepts block structure changes in the source locale',
    async (_editor, type, View) => {
      const editor = await mountDescription(type, View, false);
      const before = editor.state.doc;

      await insertBlock(editor);

      expect(editor.state.doc.eq(before)).toBe(false);
    },
  );
});
