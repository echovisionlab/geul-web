// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { Editor } from '@tiptap/core';
import { fromJson } from '@bufbuild/protobuf';
import { hydrateCanonicalBlockRoom } from '@echovisionlab/geul-common/collaboration/block-room-codec';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { expect, it } from 'vitest';
import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { EditorAuthoringModeProvider } from '@/features/editor/EditorAuthoringMode';
import messages from '@/messages/en.json';
import { TiptapEditor } from './TiptapEditor';
import { createBlockRoomProseMirrorBridge } from './block-room-prosemirror-bridge';
import {
  createPostBlockRoomTiptapController,
  createRichTextBlockRoomTiptapController,
} from './block-room-tiptap-controller';
import { setProviderAccessLevel } from '@/lib/collab/provider-control-state';
import { useEditorAccessLevel } from '@/features/editor/useEditorAccessLevel';
import { blockRoomUndoDepth } from '@/lib/collab/interactive-mutation-undo';

it.each([
  ['post', RichTextProfile.POST],
  ['work', RichTextProfile.WORK],
  ['program-event', RichTextProfile.PROGRAM_EVENT],
] as const)('%s upgrades and downgrades without losing instance, selection or undo', async (documentType, profile) => {
  const id = '10000000-0000-4000-8000-000000000001';
  const room = new Y.Doc();
  hydrateCanonicalBlockRoom(
    room,
    documentType,
    'en',
    fromJson(LocalizedRichTextDocumentSchema, {
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      profile,
      locale: 'en',
      base: { nodes: [{ block: { id, paragraph: { props: {} } }, placement: { index: 0 } }] },
      localeOverlay: {
        locale: 'en',
        blocks: [{ blockId: id, paragraph: { props: {}, content: [{ text: { text: 'hello' } }] } }],
      },
    }),
    [],
  );
  const bridge = createBlockRoomProseMirrorBridge({ document: room, documentType, locale: 'en' });
  const controller =
    documentType === 'post'
      ? createPostBlockRoomTiptapController(bridge)
      : createRichTextBlockRoomTiptapController(bridge);
  const awareness = new Awareness(room);
  const query = new QueryClient();
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  let current: Editor | null = null;
  const ready = (editor: Editor | null) => {
    current = editor;
  };
  function Surface({ allow, serverEditable }: { allow: boolean; serverEditable: boolean }) {
    const editable = useEditorAccessLevel(awareness) === 'edit' && serverEditable;
    return (
      <EditorAuthoringModeProvider
        value={{ allowNeutralBlockEdits: allow && editable, allowLocalizedBlockEdits: editable }}
      >
        <TiptapEditor
          blockRoomController={controller}
          awareness={awareness}
          localUser={{ name: 'Alice', color: '#112233' }}
          editable={editable}
          structureLocked={editable && !allow}
          onEditorReady={ready}
          externalVideo={false}
        />
      </EditorAuthoringModeProvider>
    );
  }
  const render = (allow: boolean, label: string, serverEditable = true) =>
    root.render(
      <QueryClientProvider client={query}>
        <NextIntlClientProvider
          locale="en"
          messages={{
            ...messages,
            common: { ...messages.common, labels: { ...messages.common.labels, content: label } },
          }}
        >
          <DesignSystemProvider>
            <Surface allow={allow} serverEditable={serverEditable} />
          </DesignSystemProvider>
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );
  try {
    await act(async () => {
      setProviderAccessLevel(awareness, 'view');
      render(true, 'Original content', false);
    });
    const first = current as Editor | null;
    expect(first).not.toBeNull();
    expect(first!.isEditable).toBe(false);
    await act(async () => setProviderAccessLevel(awareness, 'edit'));
    expect(current).toBe(first);
    expect(first!.isEditable).toBe(false); // Wait for refreshed server permission.
    await act(async () => render(true, 'Original content', true));
    expect(current).toBe(first);
    expect(first!.isEditable).toBe(true);
    await act(async () => {
      first!.commands.setTextSelection(4);
      first!.view.dispatch(first!.state.tr.insertText('!'));
    });
    const selection = first!.state.selection.from;
    const depth = blockRoomUndoDepth(room);
    await act(async () => {
      first!.view.dom.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      render(false, 'Changed content');
    });
    expect(current).toBe(first);
    expect(first!.isEditable).toBe(true);
    expect(first!.view.composing).toBe(true);
    expect(first!.state.selection.from).toBe(selection);
    expect(blockRoomUndoDepth(room)).toBe(depth);
    expect(first!.view.dom).toHaveAttribute('aria-label', 'Changed content');
    expect(first!.view.dom).not.toHaveAttribute('aria-keyshortcuts');
    await act(async () => {
      expect(first!.commands.insertMermaid()).toBe(false);
    });
    await act(async () => {
      first!.view.dom.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    });
    await act(async () => setProviderAccessLevel(awareness, 'view'));
    expect(current).toBe(first);
    expect(first!.isEditable).toBe(false);
    expect(first!.state.selection.from).toBe(selection);
    expect(blockRoomUndoDepth(room)).toBe(depth);
    await act(async () => setProviderAccessLevel(awareness, 'edit'));
    expect(current).toBe(first);
    expect(first!.isEditable).toBe(true);
    await act(async () => render(true, 'Unlocked content'));
    expect(current).toBe(first);
    expect(first!.isEditable).toBe(true);
    expect(first!.view.dom).toHaveAttribute('aria-keyshortcuts');
    await act(async () => {
      expect(first!.can().insertMermaid()).toBe(true);
    });
  } finally {
    await act(async () => root.unmount());
    host.remove();
    query.clear();
    awareness.destroy();
    room.destroy();
  }
});
