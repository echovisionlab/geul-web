// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fromJson } from '@bufbuild/protobuf';
import { Editor } from '@tiptap/core';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { expect, it, vi } from 'vitest';
import { hydrateCanonicalBlockRoom } from '@echovisionlab/geul-common/collaboration/block-room-codec';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { setProviderAccessLevel } from '@/lib/collab/provider-control-state';
import { useEditorAccessLevel } from '@/features/editor/useEditorAccessLevel';
import { createBlockRoomProseMirrorBridge } from '../block-room-prosemirror-bridge';
import { createRichTextBlockRoomTiptapController } from '../block-room-tiptap-controller';
import { CompactTiptapEditor } from './CompactTiptapEditor';
import { EmailTiptapEditor } from './EmailTiptapEditor';
import { PolicyTiptapEditor } from './PolicyTiptapEditor';

vi.mock('next-intl', () => ({ useLocale: () => 'en', useTranslations: () => (key: string) => key }));

it.each([
  ['artist', RichTextProfile.COMPACT],
  ['label', RichTextProfile.COMPACT],
  ['release', RichTextProfile.COMPACT],
  ['campaign', RichTextProfile.EMAIL],
  ['email-template', RichTextProfile.EMAIL],
  ['terms-history', RichTextProfile.POLICY],
  ['privacy-history', RichTextProfile.POLICY],
] as const)('%s follows current room and server permissions on the same editor', async (documentType, profile) => {
  const document = new Y.Doc();
  const id = '10000000-0000-4000-8000-000000000001';
  hydrateCanonicalBlockRoom(
    document,
    documentType,
    'en',
    fromJson(LocalizedRichTextDocumentSchema, {
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      profile,
      locale: 'en',
      base: { nodes: [{ block: { id, paragraph: { props: {} } }, placement: { index: 0 } }] },
      localeOverlay: {
        locale: 'en',
        blocks: [{ blockId: id, paragraph: { props: {}, content: [{ text: { text: 'Original body' } }] } }],
      },
    }),
    [],
  );
  const controller = createRichTextBlockRoomTiptapController(
    createBlockRoomProseMirrorBridge({ document, documentType, locale: 'en' }),
  );
  const connect = vi.spyOn(controller, 'connect');
  const awareness = new Awareness(document);
  const client = new QueryClient();
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host);
  function Surface({ serverEditable, target }: { serverEditable: boolean; target: boolean }) {
    const editable = useEditorAccessLevel(awareness) === 'edit' && serverEditable;
    const shared = {
      blockRoomController: controller,
      awareness,
      editable,
      structureLocked: editable && target,
      userName: 'Editor',
      userColor: '#112233',
    };
    if (profile === RichTextProfile.COMPACT) {
      return <CompactTiptapEditor {...shared} />;
    }
    if (profile === RichTextProfile.EMAIL) {
      return <EmailTiptapEditor {...shared} />;
    }
    return <PolicyTiptapEditor {...shared} />;
  }
  const render = (serverEditable: boolean, target = false) =>
    root.render(
      <QueryClientProvider client={client}>
        <DesignSystemProvider>
          <Surface serverEditable={serverEditable} target={target} />
        </DesignSystemProvider>
      </QueryClientProvider>,
    );
  try {
    setProviderAccessLevel(awareness, 'view');
    await act(async () => render(false));
    const editor = connect.mock.calls[0]?.[0] as Editor;
    expect(editor).toBeDefined();
    expect(editor.isEditable).toBe(false);
    const dom = editor.view.dom;
    await act(async () => setProviderAccessLevel(awareness, 'edit'));
    expect(editor.isEditable).toBe(false);
    await act(async () => render(true));
    expect(editor.isEditable).toBe(true);
    await act(async () => {
      editor.commands.setTextSelection(4);
      editor.commands.insertContent('!');
    });
    expect(editor.getText()).toContain('!');
    const selection = editor.state.selection.from;
    // Target-locale guards must change without becoming editor construction dependencies.
    await act(async () => render(true, true));
    expect(editor.isEditable).toBe(true);
    const before = editor.state.doc;
    await act(async () =>
      editor.view.dispatch(
        editor.state.tr.insert(
          1,
          editor.schema.nodes.blockContainer.create(
            { id: '10000000-0000-4000-8000-000000000002' },
            editor.schema.nodes.paragraph.create(),
          ),
        ),
      ),
    );
    expect(editor.state.doc.eq(before)).toBe(true);
    await act(async () => setProviderAccessLevel(awareness, 'view'));
    expect(editor.isEditable).toBe(false);
    await act(async () => render(false, true));
    await act(async () => setProviderAccessLevel(awareness, 'edit'));
    expect(editor.isEditable).toBe(false);
    await act(async () => render(true));
    expect(editor.isEditable).toBe(true);
    expect(editor.view.dom).toBe(dom);
    expect(editor.state.selection.from).toBe(selection);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(editor.isDestroyed).toBe(false);
  } finally {
    await act(async () => {
      root.unmount();
      await new Promise((resolve) => setTimeout(resolve, 2));
    });
    client.clear();
    awareness.destroy();
    document.destroy();
    host.remove();
  }
});
