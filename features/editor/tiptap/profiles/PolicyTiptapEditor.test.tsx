// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Editor, getSchema } from '@tiptap/core';
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
import { PolicyTiptapEditor, policyTiptapDocumentToHtml, validatePolicyTiptapDocument } from './PolicyTiptapEditor';
import { createTiptapWireExtensions } from '../wire-schema';
import { createBlockRoomProseMirrorBridge } from '../block-room-prosemirror-bridge';
import { createRichTextBlockRoomTiptapController } from '../block-room-tiptap-controller';

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

Object.defineProperties(Range.prototype, {
  getBoundingClientRect: {
    configurable: true,
    value: () => document.body.getBoundingClientRect(),
  },
  getClientRects: {
    configurable: true,
    value: () => [document.body.getBoundingClientRect()],
  },
});

const POLICY_BLOCK_ID = '019cce25-dbc0-7d12-9f1f-735b1a6c6b13';

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(async () => {
  await act(async () => {
    root?.unmount();
    // Tiptap React delays Editor.destroy() by one tick to survive StrictMode
    // remounts. Let that cleanup run while the jsdom document still exists.
    await new Promise((resolve) => setTimeout(resolve, 2));
  });
  host?.remove();
  root = null;
  host = null;
});

function container(id: string, content: Record<string, unknown>, children: Record<string, unknown>[] = []) {
  return {
    type: 'blockContainer',
    attrs: { id },
    content: [content, ...(children.length > 0 ? [{ type: 'blockGroup', content: children }] : [])],
  };
}

function documentWith(...blocks: Record<string, unknown>[]) {
  const schema = getSchema(createTiptapWireExtensions());
  return schema.nodeFromJSON({
    type: 'doc',
    content: [{ type: 'blockGroup', content: blocks }],
  });
}

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
  return createRichTextBlockRoomTiptapController(
    createBlockRoomProseMirrorBridge({
      document,
      documentType: 'terms-history',
      locale: 'en',
    }),
  );
}

describe('PolicyTiptapEditor profile', () => {
  it('keeps policy JSON compatible while serializing supported policy content and normalized links', () => {
    const document = documentWith(
      container('heading', { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Terms' }] }),
      container('bullet-one', { type: 'bulletListItem', content: [{ type: 'text', text: 'First' }] }),
      container('bullet-two', {
        type: 'bulletListItem',
        content: [{ type: 'text', text: 'Second', marks: [{ type: 'bold' }] }],
      }),
      container('quote', { type: 'quote', content: [{ type: 'text', text: 'Quoted' }] }),
      container('code', { type: 'codeBlock', content: [{ type: 'text', text: 'const terms = true;' }] }),
      container('table', {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableHeader',
                content: [{ type: 'tableParagraph', content: [{ type: 'text', text: 'Scope' }] }],
              },
            ],
          },
        ],
      }),
      container('link', {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Unsafe link',
            marks: [{ type: 'link', attrs: { href: ['java', 'script:alert(1)'].join('') } }],
          },
        ],
      }),
    );

    expect(validatePolicyTiptapDocument(document)).toBeNull();
    expect(policyTiptapDocumentToHtml(document)).toBe(
      '<h2>Terms</h2><ul><li>First</li><li><strong>Second</strong></li></ul><blockquote>Quoted</blockquote><pre><code>const terms = true;</code></pre><table><tbody><tr><th><p>Scope</p></th></tr></tbody></table><p>Unsafe link</p>',
    );
  });

  it('rejects policy-disallowed nodes instead of accepting or exporting them', () => {
    const document = documentWith(container('file', { type: 'file', attrs: { fileId: 'file-1' } }));

    expect(validatePolicyTiptapDocument(document)).toContain('nodes: file');
    expect(() => policyTiptapDocumentToHtml(document)).toThrow('policy editor does not support');
  });

  it('exports safe legacy hex color presentation without styling arbitrary durable strings', () => {
    const document = documentWith(
      container('colors', {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'safe', marks: [{ type: 'textColor', attrs: { stringValue: '#b02d23' } }] },
          { type: 'text', text: 'semantic', marks: [{ type: 'backgroundColor', attrs: { stringValue: 'blue' } }] },
          {
            type: 'text',
            text: 'unsafe',
            marks: [{ type: 'textColor', attrs: { stringValue: 'red;background:url(x)' } }],
          },
        ],
      }),
    );

    const html = policyTiptapDocumentToHtml(document);
    expect(html).toContain('data-style-value="#b02d23" style="color:#b02d23"');
    expect(html).toContain('data-style-value="blue">semantic</span>');
    expect(html).toContain('data-style-value="red;background:url(x)">unsafe</span>');
    expect(html).not.toContain('style="color:red;background');
  });

  it('serializes a Callout as a semantic wrapper around its nested content', () => {
    const document = documentWith(
      container(
        'callout',
        {
          type: 'callout',
          attrs: { icon: 'ℹ️', backgroundColor: 'blue', textColor: 'default' },
          content: [{ type: 'text', text: 'Policy note' }],
        },
        [container('callout-copy', { type: 'paragraph', content: [{ type: 'text', text: 'Nested detail' }] })],
      ),
    );

    expect(policyTiptapDocumentToHtml(document)).toBe(
      '<aside data-callout="" data-bg-color="blue" data-text-color="default"><span data-callout-icon="" aria-hidden="true">ℹ️</span><div data-callout-content=""><div data-callout-copy="">Policy note</div><p>Nested detail</p></div></aside>',
    );
  });

  it('uses the shared Tiptap command surface with the policy capability profile', async () => {
    const doc = new Y.Doc();
    const awareness = new Awareness(doc);
    const onEditorReady = vi.fn();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(
        <MantineProvider>
          <PolicyTiptapEditor
            blockRoomController={policyController(doc)}
            awareness={awareness}
            onEditorReady={onEditorReady}
          />
        </MantineProvider>,
      );
    });

    const editor = onEditorReady.mock.calls[0]?.[0] as Editor | undefined;
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
    awareness.destroy();
    doc.destroy();
  });

  it('emits an explicit error and rejects a transaction containing a disallowed node', async () => {
    const doc = new Y.Doc();
    const awareness = new Awareness(doc);
    const onEditorReady = vi.fn();
    const onUnsupportedContent = vi.fn();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(
        <MantineProvider>
          <PolicyTiptapEditor
            blockRoomController={policyController(doc)}
            awareness={awareness}
            onEditorReady={onEditorReady}
            onUnsupportedContent={onUnsupportedContent}
          />
        </MantineProvider>,
      );
    });

    const editor = onEditorReady.mock.calls[0]?.[0] as Editor | undefined;
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
    awareness.destroy();
    doc.destroy();
  });
});
