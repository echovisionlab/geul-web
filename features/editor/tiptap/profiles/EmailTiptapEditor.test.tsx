// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act } from 'react';
import type { Editor } from '@tiptap/core';
import { createSelectionBubbleMenuCommands } from '../menus/selection-bubble-commands';
import { createRoot, type Root } from 'react-dom/client';

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
import { createBlockRoomProseMirrorBridge } from '../block-room-prosemirror-bridge';
import {
  createRichTextBlockRoomTiptapController,
  type RichTextBlockRoomTiptapController,
} from '../block-room-tiptap-controller';
import { EmailTiptapEditor } from './EmailTiptapEditor';

const EMAIL_PARAGRAPH_ID = '019cce25-dbc0-7d12-9f1f-735b1a6c6b21';

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

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let yDocument: Y.Doc | null = null;
let awareness: Awareness | null = null;
const mountedEditors = new Set<Editor>();

afterEach(async () => {
  try {
    await act(async () => root?.unmount());
    // Tiptap schedules destruction to survive StrictMode remounts. Observe
    // disposal before destroying the collaboration resources it still uses.
    await vi.waitFor(() => {
      expect([...mountedEditors].every((editor) => editor.isDestroyed)).toBe(true);
    });
  } finally {
    awareness?.destroy();
    yDocument?.destroy();
    host?.remove();
    root = null;
    host = null;
    awareness = null;
    yDocument = null;
    mountedEditors.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  }
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
  const controller = createRichTextBlockRoomTiptapController(
    createBlockRoomProseMirrorBridge({ document: yDocument, documentType: 'email-template', locale: 'en' }),
  );
  const connect = controller.connect.bind(controller);
  vi.spyOn(controller, 'connect').mockImplementation((editor) => {
    mountedEditors.add(editor);
    return connect(editor);
  });
  return controller;
}

describe('EmailTiptapEditor profile', () => {
  it('mounts from the canonical Block-room controller and exposes its current content', async () => {
    yDocument = new Y.Doc();
    awareness = new Awareness(yDocument);
    const controller = emailController(yDocument);
    const onEditorReady = vi.fn();
    const onContentChange = vi.fn();
    host = window.document.createElement('div');
    window.document.body.append(host);
    root = createRoot(host);

    const render = (editable: boolean, contentLanguage = 'en', accessibleLabel = 'Campaign body') =>
      root?.render(
        <DesignSystemProvider forceColorScheme="light">
          <EmailTiptapEditor
            blockRoomController={controller}
            awareness={awareness!}
            userName="Editor"
            userColor="#3b82f6"
            accessibleLabel={accessibleLabel}
            contentLanguage={contentLanguage}
            editable={editable}
            onEditorReady={onEditorReady}
            onContentChange={onContentChange}
          />
        </DesignSystemProvider>,
      );
    await act(async () => render(false));
    await vi.waitFor(() => expect(onEditorReady).toHaveBeenCalledOnce());

    const handle = onEditorReady.mock.calls[0]?.[0];
    expect(handle).toBeDefined();
    expect(handle.getText()).toContain('Email body');
    expect(controller.connected).toBe(true);
    const surface = host.querySelector('[data-testid="email-campaign-tiptap-editor-content"]')!;
    expect(surface).toHaveAttribute('role', 'document');
    expect(surface).toHaveAttribute('aria-label', 'Campaign body');
    expect(surface).toHaveAttribute('lang', 'en');
    expect(surface).not.toHaveAttribute('aria-multiline');
    expect(surface).toHaveAttribute('contenteditable', 'false');

    await act(async () => render(true, 'ko', '캠페인 본문'));
    expect(surface).toHaveAttribute('role', 'textbox');
    expect(surface).toHaveAttribute('aria-label', '캠페인 본문');
    expect(surface).toHaveAttribute('aria-multiline', 'true');
    expect(surface).toHaveAttribute('lang', 'ko');
    expect(surface).toHaveAttribute('contenteditable', 'true');
    expect(handle.getText()).toContain('Email body');
    await act(async () => handle.insertVariable('login_code'));
    expect(onContentChange).toHaveBeenCalled();
    expect(onContentChange.mock.lastCall?.[0].getHTML()).toContain('{{login_code}}');
    expect(JSON.stringify(controller.getLocalizedDocumentSnapshot())).toContain('{{login_code}}');

    await act(async () => render(false));
    expect(surface).toHaveAttribute('role', 'document');
    expect(surface).not.toHaveAttribute('aria-multiline');
    expect(surface).toHaveAttribute('contenteditable', 'false');
  });

  it('opens a working, email-only slash menu and retains localized formatting across live structure locks', async () => {
    yDocument = new Y.Doc();
    awareness = new Awareness(yDocument);
    const controller = emailController(yDocument);
    const connect = vi.spyOn(controller, 'connect');
    const ready = vi.fn();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    const render = (structureLocked = false, editable = true) =>
      root!.render(
        <DesignSystemProvider forceColorScheme="light">
          <EmailTiptapEditor
            blockRoomController={controller}
            awareness={awareness!}
            onEditorReady={ready}
            userName="Editor"
            userColor="#3b82f6"
            structureLocked={structureLocked}
            editable={editable}
          />
        </DesignSystemProvider>,
      );
    await act(async () => render());
    await vi.waitFor(() => expect(ready).toHaveBeenCalledOnce());
    const editor: Editor = connect.mock.calls[0][0];
    const source = editor.state.doc.firstChild!.firstChild!.firstChild!;
    await act(async () => {
      editor.commands.setTextSelection({ from: 3, to: 3 + source.content.size });
      editor.commands.insertContent('/');
    });
    expect(
      [...host.querySelectorAll('[data-testid^="tiptap-slash-item-"]')].map((item) => item.getAttribute('data-testid')),
    ).toEqual([
      'tiptap-slash-item-paragraph',
      'tiptap-slash-item-heading',
      'tiptap-slash-item-heading_2',
      'tiptap-slash-item-heading_3',
      'tiptap-slash-item-bullet_list',
      'tiptap-slash-item-numbered_list',
      'tiptap-slash-item-quote',
      'tiptap-slash-item-divider',
      'tiptap-slash-item-site-variable',
    ]);
    await act(async () => {
      editor.view.dom.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
      );
    });
    await act(async () => {
      editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
    expect(editor.state.doc.firstChild!.firstChild!.firstChild!.type.name).toBe('heading');
    expect(JSON.stringify(controller.getLocalizedDocumentSnapshot())).toContain('heading');
    expect(host.querySelector('[data-testid="tiptap-slash-menu"]')).toBeNull();
    await act(async () => {
      editor.commands.insertContent('Email body');
      render(true);
    });
    expect(connect).toHaveBeenCalledTimes(1);
    await act(async () => editor.commands.setTextSelection({ from: 3, to: 8 }));
    let commands = createSelectionBubbleMenuCommands(editor);
    expect(commands.canChangeBlockType).toBe(false);
    expect(commands.canFormatText).toBe(true);
    await act(async () => {
      expect(commands.toggleTextStyle('bold')).toBe(true);
      expect(commands.toggleTextStyle('italic')).toBe(true);
      expect(commands.toggleTextStyle('underline')).toBe(true);
      expect(commands.toggleTextStyle('strike')).toBe(true);
      expect(commands.createLink({ href: 'https://example.com' })).toBe(true);
    });
    expect(ready.mock.calls[0][0].getHTML()).toMatch(/^<h1>/);
    expect(ready.mock.calls[0][0].getHTML()).toMatch(/<\/h1>$/);
    expect(editor.getHTML()).toContain('<strong>');
    expect(editor.getHTML()).toContain('<em>');
    expect(editor.getHTML()).toContain('<u>');
    expect(editor.getHTML()).toContain('<s>');
    expect(editor.getHTML()).toContain('href="https://example.com"');
    await act(async () => editor.commands.setTextSelection({ from: 3, to: 8 }));
    const menu = document.querySelector('[data-testid="tiptap-selection-menu"]');
    expect(menu).not.toBeNull();
    expect(menu!.querySelector('[aria-label="formatting.bold"]')).not.toBeNull();
    expect(menu!.querySelector('[aria-label="formatting.code"]')).toBeNull();
    await act(async () => {
      editor.commands.setTextSelection(8);
      editor.commands.insertContent(' /');
    });
    expect(host.querySelector('[data-testid="tiptap-slash-menu"]')).toBeNull();
    const before = editor.getJSON();
    await act(async () =>
      editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })),
    );
    expect(editor.getJSON()).toEqual(before);
    await act(async () => render(false));
    expect(connect).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[data-testid="tiptap-slash-menu"]')).not.toBeNull();
    await act(async () => render(false, false));
    commands = createSelectionBubbleMenuCommands(editor);
    expect(commands.canFormatText).toBe(false);
    expect(host.querySelector('[data-testid="tiptap-slash-menu"]')).toBeNull();
    expect(document.querySelector('[data-testid="tiptap-selection-menu"]')).toBeNull();
  });
});
