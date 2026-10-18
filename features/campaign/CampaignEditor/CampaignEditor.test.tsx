// @vitest-environment jsdom
// @geul-test-tier editor-integration

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
import { act, render, screen } from '@/test/render';
import { createBlockRoomProseMirrorBridge } from '@/features/editor/tiptap/block-room-prosemirror-bridge';
import { createRichTextBlockRoomTiptapController } from '@/features/editor/tiptap/block-room-tiptap-controller';
import type { EmailCampaignTiptapEditorHandle } from '@/features/editor/tiptap/profiles/EmailTiptapEditor';
import { CampaignEditor } from './CampaignEditor';

const PARAGRAPH_ID = '019cce25-dbc0-7d12-9f1f-735b1a6c6b31';

let yDocument: Y.Doc | null = null;
let awareness: Awareness | null = null;
let unmount: (() => void) | null = null;
const mountedEditors = new Set<Editor>();

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
    await vi.waitFor(() => expect([...mountedEditors].every((editor) => editor.isDestroyed)).toBe(true));
  } finally {
    awareness?.destroy();
    yDocument?.destroy();
    awareness = null;
    yDocument = null;
    unmount = null;
    mountedEditors.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  }
});

/** An in-memory campaign Block room holding one Korean paragraph. */
function campaignRoom() {
  yDocument = new Y.Doc();
  awareness = new Awareness(yDocument);
  hydrateCanonicalBlockRoom(
    yDocument,
    'campaign',
    'ko',
    fromJson(LocalizedRichTextDocumentSchema, {
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      profile: RichTextProfile.EMAIL,
      locale: 'ko',
      base: { nodes: [{ block: { id: PARAGRAPH_ID, paragraph: { props: {} } }, placement: { index: 0 } }] },
      localeOverlay: {
        locale: 'ko',
        blocks: [{ blockId: PARAGRAPH_ID, paragraph: { props: {}, content: [{ text: { text: '캠페인 본문' } }] } }],
      },
    } as JsonValue),
    [],
  );
  const controller = createRichTextBlockRoomTiptapController(
    createBlockRoomProseMirrorBridge({ document: yDocument, documentType: 'campaign', locale: 'ko' }),
  );
  const connect = controller.connect.bind(controller);
  vi.spyOn(controller, 'connect').mockImplementation((editor) => {
    mountedEditors.add(editor);
    return connect(editor);
  });
  return { controller, provider: { awareness } };
}

async function renderCampaignEditor(editable: boolean): Promise<EmailCampaignTiptapEditorHandle> {
  const { controller, provider } = campaignRoom();
  const onEditorReady = vi.fn<(editor: EmailCampaignTiptapEditorHandle) => void>();
  ({ unmount } = render(
    <CampaignEditor
      campaignId="campaign-1"
      accessibleLabel="Campaign content"
      contentLanguage="ko"
      provider={provider}
      blockRoomController={controller}
      editable={editable}
      onEditorReady={onEditorReady}
    />,
  ));
  await vi.waitFor(() => expect(onEditorReady).toHaveBeenCalled());
  return onEditorReady.mock.calls[0]![0];
}

describe('CampaignEditor', () => {
  it('opens a campaign body without edit permission read-only, labelled and in its content language', async () => {
    const editor = await renderCampaignEditor(false);

    const body = screen.getByRole('document', { name: 'Campaign content' });
    expect(body).toHaveAttribute('contenteditable', 'false');
    expect(body).toHaveAttribute('lang', 'ko');
    expect(screen.queryByRole('textbox', { name: 'Campaign content' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Insert variable' })).not.toBeInTheDocument();

    await act(async () => editor.insertVariable('site_name'));
    expect(editor.getText()).toContain('캠페인 본문');
    expect(editor.getText()).not.toContain('{{site_name}}');
  });

  it('lets a campaign editor with edit permission change the body', async () => {
    const editor = await renderCampaignEditor(true);

    const body = screen.getByRole('textbox', { name: 'Campaign content' });
    expect(body).toHaveAttribute('contenteditable', 'true');
    expect(body).toHaveAttribute('lang', 'ko');

    await act(async () => editor.insertVariable('site_name'));
    expect(editor.getText()).toContain('{{site_name}}');
  });
});
