// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Editor } from '@tiptap/core';

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
import { PolicyTiptapEditor } from './PolicyTiptapEditor';
import { createBlockRoomProseMirrorBridge } from '../block-room-prosemirror-bridge';
import { createRichTextBlockRoomTiptapController } from '../block-room-tiptap-controller';

const { translate } = vi.hoisted(() => ({ translate: (key: string) => key }));

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => translate,
}));

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

const POLICY_BLOCK_ID = '019cce25-dbc0-7d12-9f1f-735b1a6c6b13';

let root: Root | null = null;
let host: HTMLDivElement | null = null;
const mountedEditors = new Set<Editor>();
const collaborationRooms = new Set<{ document: Y.Doc; awareness: Awareness }>();

function createPolicyRoom() {
  const document = new Y.Doc();
  const room = { document, awareness: new Awareness(document) };
  collaborationRooms.add(room);
  return room;
}

afterEach(async () => {
  try {
    await act(async () => root?.unmount());
    // Tiptap schedules destruction to survive StrictMode remounts. Observe
    // disposal before destroying the collaboration resources it still uses.
    await vi.waitFor(() => {
      expect([...mountedEditors].every((editor) => editor.isDestroyed)).toBe(true);
    });
  } finally {
    for (const room of collaborationRooms) {
      room.awareness.destroy();
      room.document.destroy();
    }
    collaborationRooms.clear();
    host?.remove();
    root = null;
    host = null;
    mountedEditors.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  }
});

function policyController(document: Y.Doc) {
  hydrateCanonicalBlockRoom(
    document,
    'terms-history',
    'en',
    fromJson(LocalizedRichTextDocumentSchema, {
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      profile: RichTextProfile.POLICY,
      locale: 'en',
      base: {
        nodes: [{ block: { id: POLICY_BLOCK_ID, paragraph: { props: {} } }, placement: { index: 0 } }],
      },
      localeOverlay: {
        locale: 'en',
        blocks: [{ blockId: POLICY_BLOCK_ID, paragraph: { props: {}, content: [] } }],
      },
    } as JsonValue),
    [],
  );
  const controller = createRichTextBlockRoomTiptapController(
    createBlockRoomProseMirrorBridge({
      document,
      documentType: 'terms-history',
      locale: 'en',
    }),
  );
  const connect = controller.connect.bind(controller);
  vi.spyOn(controller, 'connect').mockImplementation((editor) => {
    mountedEditors.add(editor);
    return connect(editor);
  });
  return controller;
}

describe('PolicyTiptapEditor profile', () => {
  it('uses the shared Tiptap command surface with the policy capability profile', async () => {
    const { document: doc, awareness } = createPolicyRoom();
    const onEditorReady = vi.fn();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(
        <DesignSystemProvider forceColorScheme="light">
          <PolicyTiptapEditor
            blockRoomController={policyController(doc)}
            awareness={awareness}
            onEditorReady={onEditorReady}
          />
        </DesignSystemProvider>,
      );
    });

    const editor = onEditorReady.mock.calls.find(([instance]) => instance)?.[0] as Editor | undefined;
    expect(editor).toBeDefined();
    expect(host.querySelector('[data-editor-profile="policy"] [data-editor-engine="tiptap"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="policy-tiptap-toolbar"]')).toBeNull();

    await act(async () => {
      editor!.commands.insertContent('/');
    });

    expect(document.querySelector('[data-testid="tiptap-slash-menu"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="tiptap-slash-item-heading"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="tiptap-slash-item-table"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="tiptap-slash-item-file"]')).toBeNull();
    expect(document.querySelector('[data-testid="tiptap-slash-item-map"]')).toBeNull();
    expect(document.querySelector('[data-testid="tiptap-slash-item-math"]')).toBeNull();

    await act(async () => root?.unmount());
    root = null;
    expect(onEditorReady).toHaveBeenLastCalledWith(null);
  });

  it('emits an explicit error and rejects a transaction containing a disallowed node', async () => {
    const { document: doc, awareness } = createPolicyRoom();
    const onEditorReady = vi.fn();
    const onUnsupportedContent = vi.fn();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(
        <DesignSystemProvider forceColorScheme="light">
          <PolicyTiptapEditor
            blockRoomController={policyController(doc)}
            awareness={awareness}
            onEditorReady={onEditorReady}
            onUnsupportedContent={onUnsupportedContent}
          />
        </DesignSystemProvider>,
      );
    });

    const editor = onEditorReady.mock.calls.find(([instance]) => instance)?.[0] as Editor | undefined;
    expect(editor).toBeDefined();
    let containerPosition = -1;
    editor!.state.doc.descendants((node, position) => {
      if (containerPosition === -1 && node.type.name === 'blockContainer') {
        containerPosition = position;
      }
    });
    const current = editor!.state.doc.nodeAt(containerPosition)?.firstChild;
    const file = editor!.schema.nodes.file?.create({ fileId: 'unsupported-file' });
    expect(current).toBeDefined();
    expect(file).toBeDefined();

    act(() => {
      editor!.view.dispatch(
        editor!.state.tr.replaceWith(containerPosition + 1, containerPosition + 1 + current!.nodeSize, file!),
      );
    });

    expect(onUnsupportedContent).toHaveBeenCalledWith(expect.stringContaining('nodes: file'));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('policy editor does not support');
    expect(onEditorReady).toHaveBeenLastCalledWith(null);

    // A rebuilt canonical room supplies a new controller without remounting
    // this profile. The old room's error must not permanently block it.
    const rebuiltRoom = createPolicyRoom();
    const rebuiltController = policyController(rebuiltRoom.document);
    await act(async () => {
      root?.render(
        <DesignSystemProvider forceColorScheme="light">
          <PolicyTiptapEditor
            blockRoomController={rebuiltController}
            awareness={rebuiltRoom.awareness}
            onEditorReady={onEditorReady}
            onUnsupportedContent={onUnsupportedContent}
          />
        </DesignSystemProvider>,
      );
    });

    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(rebuiltController.connected).toBe(true);
    expect(onEditorReady.mock.lastCall?.[0]).not.toBe(editor);
    expect(onEditorReady.mock.lastCall?.[0]?.isDestroyed).toBe(false);
  });
});
