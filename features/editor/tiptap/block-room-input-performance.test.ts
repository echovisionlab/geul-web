// @vitest-environment jsdom
// Stable fixtures for comparing editor input and observation costs; no timing thresholds.
import { Editor } from '@tiptap/core';
import { fromJson, type JsonValue } from '@bufbuild/protobuf';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  LocalizedPageDocumentSchema,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { hydrateCanonicalBlockRoom } from '@echovisionlab/geul-common/collaboration/block-room-codec';
import * as Y from 'yjs';
import { afterAll, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { createBlockRoomProseMirrorBridge } from './block-room-prosemirror-bridge';
import { createPostBlockRoomTiptapController } from './block-room-tiptap-controller';
import { createTiptapWireExtensions } from './wire-schema';
import { createBlockRoomPageSectionsController } from '@/features/page/PageEditor/block-room-page-sections';

const id = (n: number) => `10000000-0000-4000-8000-${String(n + 1).padStart(12, '0')}`;
const results: unknown[] = [];
afterAll(() => {
  const reportPath = process.env.EDITOR_PERFORMANCE_REPORT;
  if (reportPath) {
    writeFileSync(reportPath, JSON.stringify({ node: process.version, results }, null, 2));
  }
});
const nodes = (start: number, n: number) =>
  Array.from({ length: n }, (_, index) => ({
    block: { id: id(start + index), paragraph: { props: {} } },
    placement: { index },
  }));
const overlays = (start: number, n: number) =>
  Array.from({ length: n }, (_, index) => ({
    blockId: id(start + index),
    paragraph: { props: {}, content: [{ text: { text: 'a'.repeat(80) } }] },
  }));
const stats = (values: number[]) => {
  const sorted = values.toSorted((a, b) => a - b);
  return {
    medianMs: Number(sorted[Math.floor(sorted.length / 2)].toFixed(2)),
    p95Ms: Number(sorted[Math.ceil(sorted.length * 0.95) - 1].toFixed(2)),
  };
};

it('measures the existing Post input path at fixed paragraph length', () => {
  for (const n of [100, 500, 1000]) {
    const room = new Y.Doc();
    hydrateCanonicalBlockRoom(
      room,
      'post',
      'en',
      fromJson(LocalizedRichTextDocumentSchema, {
        blockCatalogFingerprint: contentBlockCatalogFingerprint,
        profile: 'RICH_TEXT_PROFILE_POST',
        locale: 'en',
        base: { nodes: nodes(0, n) },
        localeOverlay: { locale: 'en', blocks: overlays(0, n) },
      } as JsonValue),
      [],
    );
    const bridge = createBlockRoomProseMirrorBridge({ document: room, documentType: 'post', locale: 'en' });
    const controller = createPostBlockRoomTiptapController(bridge);
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [...createTiptapWireExtensions(), controller.extension],
      content: controller.initialContent,
    });
    const disconnect = controller.connect(editor);
    let position = -1;
    editor.state.doc.descendants((node, pos) => {
      if (position === -1 && node.type.name === 'paragraph') {
        position = pos + 1;
        return false;
      }
    });
    expect(position).toBeGreaterThan(0);
    const samples: number[] = [];
    for (let i = 0; i < 25; i++) {
      const start = performance.now();
      editor.view.dispatch(editor.state.tr.insertText('x', position));
      if (i >= 5) {
        samples.push(performance.now() - start);
      }
    }
    expect(editor.getText().includes('x'.repeat(25))).toBe(true);
    expect(JSON.stringify(bridge.readBlocks()[0]?.localePayload)).toContain('x'.repeat(25));
    results.push({ path: 'Post full input', paragraphs: n, samples: samples.length, ...stats(samples) });
    disconnect();
    editor.destroy();
    room.destroy();
  }
}, 60000);

it('measures Page observer fanout with a fixed total of 500 paragraphs', () => {
  for (const count of [1, 5, 20]) {
    const room = new Y.Doc();
    const perSection = 500 / count;
    hydrateCanonicalBlockRoom(
      room,
      'page',
      'en',
      fromJson(LocalizedPageDocumentSchema, {
        blockCatalogFingerprint: contentBlockCatalogFingerprint,
        locale: 'en',
        base: {
          nodes: Array.from({ length: count }, (_, index) => ({
            section: {
              id: id(10000 + index),
              settings: {},
              richText: { props: {}, blocks: { nodes: nodes(index * perSection, perSection) } },
            },
            placement: { index },
          })),
        },
        localeOverlay: {
          locale: 'en',
          sections: Array.from({ length: count }, (_, index) => ({
            sectionId: id(10000 + index),
            richText: { props: {}, blocks: { locale: 'en', blocks: overlays(index * perSection, perSection) } },
          })),
        },
      } as JsonValue),
      [],
    );
    const bridges = Array.from({ length: count }, (_, index) =>
      createBlockRoomProseMirrorBridge({
        document: room,
        documentType: 'page',
        locale: 'en',
        pageSectionId: id(10000 + index),
      }),
    );
    let notifications = 0;
    const cleanup = bridges.map((bridge) =>
      bridge.observe(() => {
        notifications++;
      }),
    );
    const sections = createBlockRoomPageSectionsController(room, 'en');
    cleanup.push(
      sections.observe(() => {
        notifications++;
      }),
    );
    const samples: number[] = [];
    for (let i = 0; i < 20; i++) {
      const start = performance.now();
      bridges[0].replaceCollaborativeText({
        blockId: id(0),
        scope: 'locale',
        path: 'content[0].text.text',
        from: 0,
        to: 0,
        insert: 'x',
      });
      if (i >= 5) {
        samples.push(performance.now() - start);
      }
    }
    expect(notifications).toBe(20);
    expect(JSON.stringify(bridges[0].readBlocks()[0]?.localePayload)).toContain('x'.repeat(20));
    results.push({
      path: 'Page observers only',
      paragraphs: 500,
      sections: count,
      notificationsPerEdit: notifications / 20,
      samples: samples.length,
      ...stats(samples),
    });
    cleanup.forEach((stop) => stop());
    room.destroy();
  }
}, 60000);
