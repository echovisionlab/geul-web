'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fromJson, toJson, type JsonValue } from '@bufbuild/protobuf';
import {
  contentBlockCatalogFingerprint,
  materializeLocalizedRichTextDocument,
} from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  RichTextDocumentSchema,
  RichTextProfile,
  type RichTextDocument,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import {
  hydrateCanonicalBlockRoom,
  materializeCanonicalBlockRoom,
} from '@echovisionlab/geul-common/collaboration/block-room-codec';
import type { Editor } from '@tiptap/core';
import { NodeSelection, type Transaction } from '@tiptap/pm/state';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { EditorAuthoringModeProvider } from '@/features/editor/EditorAuthoringMode';
import { createEditorMediaRuntimeStore } from '@/features/editor/lib/editor-media-runtime-store';
import { TiptapEditor } from '@/features/editor/tiptap/TiptapEditor';
import { createBlockRoomProseMirrorBridge } from '@/features/editor/tiptap/block-room-prosemirror-bridge';
import { createPostBlockRoomTiptapController } from '@/features/editor/tiptap/block-room-tiptap-controller';

const YOUTUBE_URL = 'https://youtu.be/dQw4w9WgXcQ?t=60';
const BLOCK_IDS = {
  headingBoundary: '10000000-0000-4000-8000-000000000007',
  emptyBoundary: '10000000-0000-4000-8000-000000000008',
  intro: '10000000-0000-4000-8000-000000000001',
  middle: '10000000-0000-4000-8000-000000000002',
  table: '10000000-0000-4000-8000-000000000009',
  youtube: '10000000-0000-4000-8000-000000000003',
  audioOne: '10000000-0000-4000-8000-000000000004',
  audioTwo: '10000000-0000-4000-8000-000000000005',
  tail: '10000000-0000-4000-8000-000000000006',
} as const;
const TABLE_IDS = {
  rows: ['30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002'],
  cells: [
    '30000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000004',
    '30000000-0000-4000-8000-000000000005',
    '30000000-0000-4000-8000-000000000006',
  ],
} as const;
const FILE_IDS = {
  audioOne: '20000000-0000-4000-8000-000000000001',
  audioTwo: '20000000-0000-4000-8000-000000000002',
} as const;

interface SelectionDebugEntry {
  sequence: number;
  trigger: string;
  event?: {
    type: string;
    key?: string;
    button?: number;
    clientX?: number;
    clientY?: number;
    shift: boolean;
    meta: boolean;
    alt: boolean;
    ctrl: boolean;
    defaultPrevented: boolean;
    target: string;
  };
  prosemirror: {
    type: string;
    from: number;
    to: number;
    anchor: number;
    head: number;
    empty: boolean;
    anchorParent: string;
    headParent: string;
    nodeType?: string;
    blocks: Array<{ id: string; type: string; position: number }>;
  };
  dom: {
    type: string;
    text: string;
    anchor: string;
    focus: string;
    insideEditor: boolean;
  };
  nodeViews: {
    covered: string[];
    editing: string[];
  };
}

function describeElement(element: Element | null): string {
  if (!element) {
    return 'none';
  }
  const boundary = element.closest('[data-content-type], [data-node-type]');
  if (boundary) {
    const type = boundary.getAttribute('data-content-type') ?? boundary.getAttribute('data-node-type') ?? 'unknown';
    const id = boundary.getAttribute('data-id');
    return id ? `${type}#${id}` : type;
  }
  return element.tagName.toLowerCase();
}

function describeDomPoint(node: Node | null, offset: number): string {
  if (!node) {
    return 'none';
  }
  const element = node instanceof Element ? node : node.parentElement;
  const text = node.nodeType === Node.TEXT_NODE ? (node.textContent ?? '').replaceAll(/\s+/g, ' ').slice(0, 36) : '';
  return `${describeElement(element)}@${offset}${text ? ` "${text}"` : ''}`;
}

function selectedBlocks(editor: Editor): Array<{ id: string; type: string; position: number }> {
  const { from, to } = editor.state.selection;
  const blocks: Array<{ id: string; type: string; position: number }> = [];
  const seen = new Set<number>();
  editor.state.doc.nodesBetween(from, Math.max(from, to), (node, position) => {
    if (node.type.name !== 'blockContainer' || seen.has(position)) {
      return;
    }
    seen.add(position);
    blocks.push({
      id: typeof node.attrs.id === 'string' ? node.attrs.id : '',
      type: node.firstChild?.type.name ?? 'empty',
      position,
    });
  });
  if (blocks.length === 0) {
    const resolved = editor.state.doc.resolve(from);
    for (let depth = resolved.depth; depth > 0; depth -= 1) {
      const node = resolved.node(depth);
      if (node.type.name === 'blockContainer') {
        blocks.push({
          id: typeof node.attrs.id === 'string' ? node.attrs.id : '',
          type: node.firstChild?.type.name ?? 'empty',
          position: resolved.before(depth),
        });
        break;
      }
    }
  }
  return blocks;
}

function eventSnapshot(event: Event): SelectionDebugEntry['event'] {
  const keyboard = event instanceof KeyboardEvent ? event : null;
  const mouse = event instanceof MouseEvent ? event : null;
  return {
    type: event.type,
    ...(keyboard ? { key: keyboard.key } : {}),
    ...(mouse
      ? {
          button: mouse.button,
          clientX: Math.round(mouse.clientX),
          clientY: Math.round(mouse.clientY),
        }
      : {}),
    shift: keyboard?.shiftKey ?? mouse?.shiftKey ?? false,
    meta: keyboard?.metaKey ?? mouse?.metaKey ?? false,
    alt: keyboard?.altKey ?? mouse?.altKey ?? false,
    ctrl: keyboard?.ctrlKey ?? mouse?.ctrlKey ?? false,
    defaultPrevented: event.defaultPrevented,
    target: describeElement(event.target instanceof Element ? event.target : null),
  };
}

function captureSelectionDebugEntry(
  editor: Editor,
  sequence: number,
  trigger: string,
  event?: Event,
): SelectionDebugEntry {
  const selection = editor.state.selection;
  const domSelection = document.getSelection();
  const editorDom = editor.view.dom;
  const covered = [...editorDom.querySelectorAll('.ProseMirror-selectednode')].map((element) =>
    describeElement(element.firstElementChild ?? element),
  );
  const editing = [...editorDom.querySelectorAll('[data-selected="true"]')].map((element) => describeElement(element));
  const anchorElement = domSelection?.anchorNode
    ? domSelection.anchorNode instanceof Element
      ? domSelection.anchorNode
      : domSelection.anchorNode.parentElement
    : null;
  const focusElement = domSelection?.focusNode
    ? domSelection.focusNode instanceof Element
      ? domSelection.focusNode
      : domSelection.focusNode.parentElement
    : null;
  return {
    sequence,
    trigger,
    ...(event ? { event: eventSnapshot(event) } : {}),
    prosemirror: {
      type: selection.constructor.name,
      from: selection.from,
      to: selection.to,
      anchor: selection.anchor,
      head: selection.head,
      empty: selection.empty,
      anchorParent: selection.$anchor.parent.type.name,
      headParent: selection.$head.parent.type.name,
      ...(selection instanceof NodeSelection ? { nodeType: selection.node.type.name } : {}),
      blocks: selectedBlocks(editor),
    },
    dom: {
      type: domSelection?.type ?? 'None',
      text: domSelection?.toString() ?? '',
      anchor: describeDomPoint(domSelection?.anchorNode ?? null, domSelection?.anchorOffset ?? 0),
      focus: describeDomPoint(domSelection?.focusNode ?? null, domSelection?.focusOffset ?? 0),
      insideEditor: Boolean(
        (anchorElement && editorDom.contains(anchorElement)) || (focusElement && editorDom.contains(focusElement)),
      ),
    },
    nodeViews: { covered, editing },
  };
}

function labDocument(): RichTextDocument {
  const base = [
    { id: BLOCK_IDS.headingBoundary, heading: { props: { level: 1 } } },
    { id: BLOCK_IDS.emptyBoundary, paragraph: { props: {} } },
    { id: BLOCK_IDS.intro, paragraph: { props: {} } },
    { id: BLOCK_IDS.middle, paragraph: { props: {} } },
    {
      id: BLOCK_IDS.table,
      table: {
        props: {},
        content: {
          rows: [
            {
              id: TABLE_IDS.rows[0],
              cells: [
                { id: TABLE_IDS.cells[0], header: true, props: {} },
                { id: TABLE_IDS.cells[1], header: true, props: {} },
              ],
            },
            {
              id: TABLE_IDS.rows[1],
              cells: [
                { id: TABLE_IDS.cells[2], props: {} },
                { id: TABLE_IDS.cells[3], props: {} },
              ],
            },
          ],
        },
      },
    },
    {
      id: BLOCK_IDS.youtube,
      paragraph: { props: { previewWidth: 64, textAlignment: 'TEXT_ALIGNMENT_CENTER' } },
    },
    {
      id: BLOCK_IDS.audioOne,
      file: {
        props: {
          attachment: { activeFileId: FILE_IDS.audioOne },
          name: 'local-tone-one.wav',
          previewWidth: 100,
        },
      },
    },
    {
      id: BLOCK_IDS.audioTwo,
      file: {
        props: {
          attachment: { activeFileId: FILE_IDS.audioTwo },
          name: 'local-tone-two.wav',
          previewWidth: 100,
        },
      },
    },
    { id: BLOCK_IDS.tail, paragraph: { props: {} } },
  ];
  const locale = [
    {
      blockId: BLOCK_IDS.headingBoundary,
      heading: { props: {}, content: [{ text: { text: 'Hell' } }] },
    },
    { blockId: BLOCK_IDS.emptyBoundary, paragraph: { props: {}, content: [] } },
    {
      blockId: BLOCK_IDS.intro,
      paragraph: { props: {}, content: [{ text: { text: 'Intro paragraph for typing and selection.' } }] },
    },
    {
      blockId: BLOCK_IDS.middle,
      paragraph: { props: {}, content: [{ text: { text: 'Split this paragraph in the middle.' } }] },
    },
    {
      blockId: BLOCK_IDS.table,
      table: {
        props: {},
        content: {
          rows: [
            {
              rowId: TABLE_IDS.rows[0],
              cells: [
                { cellId: TABLE_IDS.cells[0], content: [{ text: { text: 'Purpose' } }] },
                { cellId: TABLE_IDS.cells[1], content: [{ text: { text: 'Retention' } }] },
              ],
            },
            {
              rowId: TABLE_IDS.rows[1],
              cells: [
                { cellId: TABLE_IDS.cells[2], content: [{ text: { text: 'Account operations' } }] },
                { cellId: TABLE_IDS.cells[3], content: [{ text: { text: 'Two years' } }] },
              ],
            },
          ],
        },
      },
    },
    {
      blockId: BLOCK_IDS.youtube,
      paragraph: {
        props: {},
        content: [{ link: { href: YOUTUBE_URL, content: [{ text: YOUTUBE_URL }] } }],
      },
    },
    { blockId: BLOCK_IDS.audioOne, file: { props: { caption: 'First local audio fixture' } } },
    { blockId: BLOCK_IDS.audioTwo, file: { props: { caption: 'Second local audio fixture' } } },
    {
      blockId: BLOCK_IDS.tail,
      paragraph: { props: {}, content: [{ text: { text: 'Backspace across the audio boundary here.' } }] },
    },
  ];

  return fromJson(RichTextDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile: RichTextProfile.POST,
    sourceLocale: 'en',
    base: {
      nodes: base.map((block, index) => ({ block, placement: { index } })),
    },
    localeOverlays: [{ locale: 'en', blocks: locale }],
  } as unknown as JsonValue);
}

function createToneUrl(frequency: number): string {
  const sampleRate = 8000;
  const sampleCount = 2000;
  const bytes = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(bytes);
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };
  writeText(0, 'RIFF');
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, sampleCount * 2, true);
  for (let index = 0; index < sampleCount; index += 1) {
    const envelope = 1 - index / sampleCount;
    const sample = Math.sin((2 * Math.PI * frequency * index) / sampleRate) * envelope * 0.25;
    view.setInt16(44 + index * 2, Math.round(sample * 32767), true);
  }
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
}

function serializeRoom(room: Y.Doc): string {
  const document = materializeCanonicalBlockRoom(room, 'post');
  if (document.$typeName !== 'api.content.v1.LocalizedRichTextDocument') {
    throw new Error('Editor lab expected a Post rich-text document.');
  }
  return JSON.stringify(toJson(LocalizedRichTextDocumentSchema, document), null, 2);
}

export function EditorInteractionLab() {
  const fixture = useMemo(() => {
    const room = new Y.Doc();
    const aggregate = labDocument();
    hydrateCanonicalBlockRoom(
      room,
      'post',
      aggregate.sourceLocale,
      materializeLocalizedRichTextDocument(aggregate, aggregate.sourceLocale),
      [],
    );
    const bridge = createBlockRoomProseMirrorBridge({
      document: room,
      documentType: 'post',
      locale: 'en',
      origin: 'local-editor-interaction-lab',
    });
    return {
      room,
      awareness: new Awareness(room),
      controller: createPostBlockRoomTiptapController(bridge),
      runtimeStore: createEditorMediaRuntimeStore(),
    };
  }, []);
  const editorRef = useRef<Editor | null>(null);
  const transactionListenerRef = useRef<((props: { transaction: Transaction }) => void) | null>(null);
  const selectionDebugCleanupRef = useRef<(() => void) | null>(null);
  const selectionDebugSequenceRef = useRef(0);
  const selectionDebugOutputRef = useRef<HTMLPreElement>(null);
  const toneUrlsRef = useRef<readonly [string, string] | null>(null);
  const [editable, setEditable] = useState(true);
  const [editorKey, setEditorKey] = useState(0);
  const [snapshot, setSnapshot] = useState(() => serializeRoom(fixture.room));
  const [selectionDebugLog, setSelectionDebugLog] = useState<SelectionDebugEntry[]>([]);
  const [selectionDebugCopied, setSelectionDebugCopied] = useState(false);
  const authoringMode = useMemo(() => ({ allowNeutralBlockEdits: true, allowLocalizedBlockEdits: true }), []);
  const localUser = useMemo(() => ({ name: 'Local editor tester', color: '#1c7ed6' }), []);

  const appendSelectionDebugLog = useCallback((editor: Editor, trigger: string, event?: Event) => {
    selectionDebugSequenceRef.current += 1;
    const entry = captureSelectionDebugEntry(editor, selectionDebugSequenceRef.current, trigger, event);
    setSelectionDebugLog((current) => [...current.slice(-199), entry]);
    setSelectionDebugCopied(false);
  }, []);

  useEffect(() => {
    const output = selectionDebugOutputRef.current;
    if (output) {
      output.scrollTop = output.scrollHeight;
    }
  }, [selectionDebugLog]);

  const patchAudioRuntime = useCallback(
    (urls: readonly [string, string]) => {
      fixture.runtimeStore.patchFile(FILE_IDS.audioOne, {
        fileName: 'local-tone-one.wav',
        mimeType: 'audio/wav',
        processingStatus: 'ready',
        originalUrl: urls[0],
        duration: '0.25',
      });
      fixture.runtimeStore.patchFile(FILE_IDS.audioTwo, {
        fileName: 'local-tone-two.wav',
        mimeType: 'audio/wav',
        processingStatus: 'ready',
        originalUrl: urls[1],
        duration: '0.25',
      });
    },
    [fixture.runtimeStore],
  );

  useEffect(() => {
    const urls = [createToneUrl(440), createToneUrl(660)] as const;
    toneUrlsRef.current = urls;
    patchAudioRuntime(urls);
    return () => {
      toneUrlsRef.current = null;
      URL.revokeObjectURL(urls[0]);
      URL.revokeObjectURL(urls[1]);
    };
  }, [patchAudioRuntime]);

  const onEditorReady = useCallback(
    (editor: Editor | null) => {
      if (editorRef.current && transactionListenerRef.current) {
        editorRef.current.off('transaction', transactionListenerRef.current);
      }
      selectionDebugCleanupRef.current?.();
      editorRef.current = editor;
      transactionListenerRef.current = null;
      selectionDebugCleanupRef.current = null;
      if (!editor || editor.isDestroyed) {
        return;
      }
      let editorElement: HTMLElement;
      try {
        editorElement = editor.view.dom;
      } catch {
        // Fast Refresh can dispose the previous view before its ready callback
        // is cleaned up. Selection diagnostics are optional in this local lab.
        return;
      }
      if (toneUrlsRef.current) {
        patchAudioRuntime(toneUrlsRef.current);
      }
      const updateSnapshot = ({ transaction }: { transaction: Transaction }) => {
        if (transaction.docChanged) {
          setSnapshot(serializeRoom(fixture.room));
        }
        if (transaction.selectionSet || transaction.docChanged) {
          appendSelectionDebugLog(
            editor,
            `transaction${transaction.selectionSet ? ':selection' : ''}${transaction.docChanged ? ':document' : ''}`,
          );
        }
      };
      transactionListenerRef.current = updateSnapshot;
      editor.on('transaction', updateSnapshot);

      let selectionFrame = 0;
      const settleEvent = (event: Event) => {
        requestAnimationFrame(() => appendSelectionDebugLog(editor, `event:${event.type}`, event));
      };
      const eventTypes = ['keydown', 'keyup', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click'] as const;
      for (const eventType of eventTypes) {
        editorElement.addEventListener(eventType, settleEvent, true);
      }
      const handleSelectionChange = () => {
        const domSelection = document.getSelection();
        const anchor = domSelection?.anchorNode;
        const focus = domSelection?.focusNode;
        if ((!anchor || !editorElement.contains(anchor)) && (!focus || !editorElement.contains(focus))) {
          return;
        }
        cancelAnimationFrame(selectionFrame);
        selectionFrame = requestAnimationFrame(() => appendSelectionDebugLog(editor, 'dom:selectionchange'));
      };
      document.addEventListener('selectionchange', handleSelectionChange);
      selectionDebugCleanupRef.current = () => {
        cancelAnimationFrame(selectionFrame);
        for (const eventType of eventTypes) {
          editorElement.removeEventListener(eventType, settleEvent, true);
        }
        document.removeEventListener('selectionchange', handleSelectionChange);
      };
      appendSelectionDebugLog(editor, 'editor:ready');
    },
    [appendSelectionDebugLog, fixture.room, patchAudioRuntime],
  );

  useEffect(
    () => () => {
      if (editorRef.current && transactionListenerRef.current) {
        editorRef.current.off('transaction', transactionListenerRef.current);
      }
      selectionDebugCleanupRef.current?.();
      fixture.awareness.destroy();
      fixture.room.destroy();
    },
    [fixture],
  );

  return (
    <main style={{ margin: '0 auto', maxWidth: 1120, padding: '24px' }}>
      <h1>Local Tiptap interaction lab</h1>
      <p>This route uses the production editor with an in-memory Block Room. It does not connect to API or Collab.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <button type="button" onClick={() => setEditable((value) => !value)}>
          {editable ? 'Switch read-only' : 'Switch editable'}
        </button>
        <button type="button" onClick={() => setEditorKey((value) => value + 1)}>
          Remount editor
        </button>
      </div>
      <div>
        <EditorAuthoringModeProvider value={authoringMode}>
          <TiptapEditor
            key={editorKey}
            blockRoomController={fixture.controller}
            awareness={fixture.awareness}
            localUser={localUser}
            editable={editable}
            mediaRuntimeStore={fixture.runtimeStore}
            onEditorReady={onEditorReady}
          />
        </EditorAuthoringModeProvider>
      </div>
      <details open style={{ marginTop: 24 }}>
        <summary>Selection debug log (local only)</summary>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '12px 0' }}>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard
                .writeText(JSON.stringify(selectionDebugLog, null, 2))
                .then(() => setSelectionDebugCopied(true));
            }}
          >
            {selectionDebugCopied ? 'Copied' : 'Copy log'}
          </button>
          <button
            type="button"
            onClick={() => {
              selectionDebugSequenceRef.current = 0;
              setSelectionDebugLog([]);
              setSelectionDebugCopied(false);
            }}
          >
            Clear log
          </button>
          <span>{selectionDebugLog.length} entries (keeps latest 200)</span>
        </div>
        <pre
          ref={selectionDebugOutputRef}
          data-testid="selection-debug-log"
          style={{ maxHeight: 520, overflow: 'auto', whiteSpace: 'pre-wrap' }}
        >
          {selectionDebugLog.map((entry) => JSON.stringify(entry)).join('\n')}
        </pre>
      </details>
      <details open style={{ marginTop: 24 }}>
        <summary>Canonical Block Room snapshot</summary>
        <pre data-testid="canonical-snapshot" style={{ maxHeight: 420, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
          {snapshot}
        </pre>
      </details>
    </main>
  );
}
