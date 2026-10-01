// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { fromJson, type JsonValue } from '@bufbuild/protobuf';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { hydrateCanonicalBlockRoom } from '@echovisionlab/geul-common/collaboration/block-room-codec';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { createBlockRoomProseMirrorBridge } from '../block-room-prosemirror-bridge';
import {
  createRichTextBlockRoomTiptapController,
  type RichTextBlockRoomTiptapController,
} from '../block-room-tiptap-controller';
import {
  EmailTiptapEditor,
  normalizeEmailCampaignPreviewHtml,
  normalizeEmailCampaignVariable,
} from './EmailTiptapEditor';

const EMAIL_PARAGRAPH_ID = '019cce25-dbc0-7d12-9f1f-735b1a6c6b21';

const { translate } = vi.hoisted(() => ({ translate: (key: string) => key }));

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => translate,
}));

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let yDocument: Y.Doc | null = null;
let awareness: Awareness | null = null;

afterEach(async () => {
  await act(async () => {
    root?.unmount();
    // Tiptap React delays Editor.destroy() by one tick to survive StrictMode remounts.
    await new Promise((resolve) => setTimeout(resolve, 2));
  });
  awareness?.destroy();
  yDocument?.destroy();
  host?.remove();
  root = null;
  host = null;
  awareness = null;
  yDocument = null;
});

function emailController(yDocument: Y.Doc): RichTextBlockRoomTiptapController {
  hydrateCanonicalBlockRoom(
    yDocument,
    'email-template',
    'en',
    fromJson(LocalizedRichTextDocumentSchema, {
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      profile: RichTextProfile.EMAIL,
      locale: 'en',
      base: {
        nodes: [{ block: { id: EMAIL_PARAGRAPH_ID, paragraph: { props: {} } }, placement: { index: 0 } }],
      },
      localeOverlay: {
        locale: 'en',
        blocks: [
          {
            blockId: EMAIL_PARAGRAPH_ID,
            paragraph: { props: {}, content: [{ text: { text: 'Email body' } }] },
          },
        ],
      },
    } as JsonValue),
    [],
  );
  return createRichTextBlockRoomTiptapController(
    createBlockRoomProseMirrorBridge({ document: yDocument, documentType: 'email-template', locale: 'en' }),
  );
}

describe('EmailTiptapEditor profile', () => {
  it('mounts from the canonical Block-room controller and exposes its current content', async () => {
    yDocument = new Y.Doc();
    awareness = new Awareness(yDocument);
    const controller = emailController(yDocument);
    const onEditorReady = vi.fn();
    host = window.document.createElement('div');
    window.document.body.append(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(
        <MantineProvider>
          <EmailTiptapEditor
            blockRoomController={controller}
            awareness={awareness!}
            userName="Editor"
            userColor="#3b82f6"
            editable={false}
            onEditorReady={onEditorReady}
          />
        </MantineProvider>,
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2));
    });

    const handle = onEditorReady.mock.calls[0]?.[0];
    expect(handle).toBeDefined();
    expect(handle.getText()).toContain('Email body');
    expect(controller.connected).toBe(true);
    expect(host.querySelector('[data-testid="email-campaign-tiptap-editor-content"]')).not.toBeNull();
  });

  it('formats variables and preserves placeholder links for email previews', () => {
    expect(normalizeEmailCampaignVariable('recipient_name')).toBe('{{recipient_name}}');
    expect(normalizeEmailCampaignVariable('{{site_name}}')).toBe('{{site_name}}');
    expect(normalizeEmailCampaignVariable('   ')).toBe('');
    expect(normalizeEmailCampaignPreviewHtml('<a href="https://{{verification_url}}">Verify</a>')).toBe(
      '<a href="{{verification_url}}">Verify</a>',
    );
  });
});
