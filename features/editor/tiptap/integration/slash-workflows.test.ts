// @vitest-environment jsdom

import { Editor, type JSONContent } from '@tiptap/core';
import { describe, expect, it, vi } from 'vitest';
import enMessages from '@/messages/en.json';
import { createTiptapEditorGeneration } from '../editor-generation';
import { createP5SketchExtension } from '../p5';
import { DEFAULT_P5_SKETCH_LABELS } from '../p5/p5-labels.fixtures';
import { createShaderExtension } from '../shader';
import { createTiptapSlashCatalog } from '../slash/catalog';
import { executeTiptapSlashItem } from '../slash/execute';
import type { TiptapSlashActionContext, TiptapSlashMenuMessages, TiptapSlashRange } from '../slash/types';
import { createTiptapWireExtensions } from '../wire-schema';
import { createFileWorkflow, createImmediateNodeWorkflow } from './slash-workflows';
import { applyFileBlockWorkflow, createFileBlockInsert, createFileBlockInsertSession } from './file-block-workflow';
import { createMapBlock } from '@/features/editor/hooks/useEditorFeatures';
import { createTiptapEditorMediaCommandPort } from '@/features/editor/lib/media-block-updates';
import { applyMapInsertWorkflow } from './map-insert-workflow';

vi.mock('@/features/editor/tiptap/code-editor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/editor/tiptap/code-editor')>()),
  MonacoSourceEditor: () => null,
}));

const serialized = enMessages.editorCommon.editor.slashMenu;

function slashItem<Key extends keyof typeof serialized.items>(key: Key) {
  const item = serialized.items[key];
  return { ...item, aliases: item.aliases.split('\n') };
}

const messages: TiptapSlashMenuMessages = {
  placeholder: serialized.placeholder,
  unavailable: serialized.unavailable,
  groups: serialized.groups,
  items: {
    heading: slashItem('heading'),
    heading2: slashItem('heading2'),
    heading3: slashItem('heading3'),
    paragraph: slashItem('paragraph'),
    bulletList: slashItem('bulletList'),
    numberedList: slashItem('numberedList'),
    checkList: slashItem('checkList'),
    quote: slashItem('quote'),
    callout: slashItem('callout'),
    divider: slashItem('divider'),
    codeBlock: slashItem('codeBlock'),
    table: slashItem('table'),
    emoji: slashItem('emoji'),
    mathBlock: slashItem('mathBlock'),
    inlineMath: slashItem('inlineMath'),
    map: slashItem('map'),
    externalVideo: slashItem('externalVideo'),
    p5Sketch: slashItem('p5Sketch'),
    threeScene: slashItem('threeScene'),
    shader: slashItem('shader'),
    file: slashItem('file'),
    aiAssistant: slashItem('aiAssistant'),
  },
};

function p5Item(callback: (context: TiptapSlashActionContext) => boolean | void) {
  const item = createTiptapSlashCatalog(messages, {
    capabilities: { p5: true },
    callbacks: { p5: callback },
  }).find((candidate) => candidate.key === 'p5');
  if (!item) {
    throw new Error('The p5 slash item is missing');
  }
  return item;
}

function mount(content: JSONContent) {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = new Editor({
    element,
    extensions: [
      ...createTiptapWireExtensions(),
      createP5SketchExtension({ labels: DEFAULT_P5_SKETCH_LABELS }),
      createShaderExtension(),
    ],
    content,
  });
  return {
    editor,
    destroy() {
      editor.destroy();
      element.remove();
    },
  };
}

function block(id: string, text: string, nested?: JSONContent[]): JSONContent {
  return {
    type: 'blockContainer',
    attrs: { id },
    content: [
      { type: 'paragraph', content: text ? [{ type: 'text', text }] : undefined },
      ...(nested ? [{ type: 'blockGroup', content: nested }] : []),
    ],
  };
}

function doc(blocks: JSONContent[]): JSONContent {
  return { type: 'doc', content: [{ type: 'blockGroup', content: blocks }] };
}

function slashRange(editor: Editor, blockId: string): TiptapSlashRange {
  let result: TiptapSlashRange | null = null;
  editor.state.doc.descendants((node, position) => {
    if (node.type.name !== 'blockContainer' || node.attrs.id !== blockId) {
      return true;
    }
    const content = node.firstChild;
    const slashOffset = content?.textContent.lastIndexOf('/') ?? -1;
    if (!content || slashOffset < 0) {
      return false;
    }
    const contentPosition = position + 1;
    const from = contentPosition + 1 + slashOffset;
    result = { from, to: from + content.textContent.length - slashOffset, contentPosition, blockId };
    return false;
  });
  const range = requireValue<TiptapSlashRange>(result, `Slash block ${blockId} is missing`);
  editor.commands.setTextSelection(range.to);
  return range;
}

function containers(value: ReturnType<Editor['getJSON']>) {
  return value.content?.[0]?.content ?? [];
}

function requireValue<Value>(value: Value | null | undefined, message: string): Value {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

function blockId(value: JSONContent | undefined): string | undefined {
  return typeof value?.attrs?.id === 'string' ? value.attrs.id : undefined;
}

function requireBlockId(value: JSONContent | undefined, message: string): string {
  return requireValue(blockId(value), message);
}

describe('Tiptap slash workflow placement', () => {
  it('inserts a Shader block through the same exact-anchor workflow', () => {
    const mounted = mount(doc([block('shader-prefix', 'Hello /shader')]));
    const range = slashRange(mounted.editor, 'shader-prefix');
    const callback = createImmediateNodeWorkflow(mounted.editor, 'shader');
    const item = createTiptapSlashCatalog(messages, {
      capabilities: { shader: true },
      callbacks: { shader: callback },
    }).find((candidate) => candidate.key === 'shader');
    if (!item) {
      throw new Error('The Shader slash item is missing');
    }

    expect(executeTiptapSlashItem({ editor: mounted.editor, item, range, callbacks: { shader: callback } })).toEqual({
      status: 'applied',
      editorMutations: 1,
    });
    const inserted = containers(mounted.editor.getJSON());
    expect(inserted).toHaveLength(2);
    expect(inserted[0]).toMatchObject({
      attrs: { id: 'shader-prefix' },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello ' }] }],
    });
    expect(inserted[1]).toMatchObject({ content: [{ type: 'shader' }] });
    mounted.destroy();
  });

  it('preserves Hello and its durable ID, then inserts p5 as the immediate next block in one mutation', () => {
    const mounted = mount(doc([block('prefix', 'Hello /p5'), block('tail', 'Tail')]));
    const range = slashRange(mounted.editor, 'prefix');
    const callback = createImmediateNodeWorkflow(mounted.editor, 'p5Sketch');
    const onTransaction = vi.fn();
    mounted.editor.on('transaction', onTransaction);

    expect(
      executeTiptapSlashItem({ editor: mounted.editor, item: p5Item(callback), range, callbacks: { p5: callback } }),
    ).toEqual({ status: 'applied', editorMutations: 1 });
    const blocks = containers(mounted.editor.getJSON());
    expect(onTransaction).toHaveBeenCalledTimes(1);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({
      attrs: { id: 'prefix' },
      content: [{ type: 'paragraph', content: [{ text: 'Hello ' }] }],
    });
    expect(blocks[1]).toMatchObject({ content: [{ type: 'p5Sketch' }] });
    const insertedBlockId = requireBlockId(blocks[1], 'Inserted p5 block ID is missing');
    expect(insertedBlockId).toEqual(expect.any(String));
    expect(insertedBlockId).not.toBe('prefix');
    expect(blocks[2]).toMatchObject({ attrs: { id: 'tail' } });
    mounted.destroy();
  });

  it('replaces a slash-only block and retains its durable ID', () => {
    const mounted = mount(doc([block('slash-only', '/p5')]));
    const range = slashRange(mounted.editor, 'slash-only');
    const callback = createImmediateNodeWorkflow(mounted.editor, 'p5Sketch');

    expect(
      executeTiptapSlashItem({ editor: mounted.editor, item: p5Item(callback), range, callbacks: { p5: callback } }),
    ).toMatchObject({ status: 'applied', editorMutations: 1 });
    expect(containers(mounted.editor.getJSON())).toEqual([
      expect.objectContaining({
        attrs: expect.objectContaining({ id: 'slash-only' }),
        content: [expect.objectContaining({ type: 'p5Sketch' })],
      }),
    ]);
    mounted.destroy();
  });

  it('preserves text after the trigger by inserting a sibling instead of replacing the block', () => {
    const mounted = mount(doc([block('suffix', '/p5 world')]));
    const range = slashRange(mounted.editor, 'suffix');
    range.to = range.from + '/p5'.length;
    mounted.editor.commands.setTextSelection(range.to);
    const callback = createImmediateNodeWorkflow(mounted.editor, 'p5Sketch');

    expect(
      executeTiptapSlashItem({ editor: mounted.editor, item: p5Item(callback), range, callbacks: { p5: callback } }),
    ).toMatchObject({ status: 'applied' });
    const blocks = containers(mounted.editor.getJSON());
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ attrs: { id: 'suffix' }, content: [{ content: [{ text: ' world' }] }] });
    expect(blocks[1]).toMatchObject({ content: [{ type: 'p5Sketch' }] });
    mounted.destroy();
  });

  it('fails closed when a delegated exact anchor still exists but changed', () => {
    const mounted = mount(doc([block('stale', 'Hello /p5')]));
    const range = slashRange(mounted.editor, 'stale');
    let captured: TiptapSlashActionContext | undefined;
    const capture = (context: TiptapSlashActionContext) => {
      captured = context;
    };
    expect(
      executeTiptapSlashItem({ editor: mounted.editor, item: p5Item(capture), range, callbacks: { p5: capture } }),
    ).toMatchObject({ status: 'delegated', editorMutations: 0 });
    mounted.editor.commands.insertContent(' changed');
    const before = mounted.editor.getJSON();
    const onTransaction = vi.fn();
    mounted.editor.on('transaction', onTransaction);
    const capturedContext = requireValue<TiptapSlashActionContext>(captured, 'Stale modal context fixture is missing');

    expect(createImmediateNodeWorkflow(mounted.editor, 'p5Sketch')(capturedContext)).toBe(false);
    expect(onTransaction).not.toHaveBeenCalled();
    expect(mounted.editor.getJSON()).toEqual(before);
    mounted.destroy();
  });

  it('falls back after the current cursor block when the captured modal block was deleted', () => {
    const mounted = mount(doc([block('deleted', 'Hello /p5'), block('cursor', 'Cursor'), block('tail', 'Tail')]));
    const range = slashRange(mounted.editor, 'deleted');
    let captured: TiptapSlashActionContext | undefined;
    const capture = (context: TiptapSlashActionContext) => {
      captured = context;
    };
    executeTiptapSlashItem({ editor: mounted.editor, item: p5Item(capture), range, callbacks: { p5: capture } });
    const source = requireValue(findContainer(mounted.editor, 'deleted'), 'Deleted modal anchor fixture is missing');
    const capturedContext = requireValue<TiptapSlashActionContext>(
      captured,
      'Deleted modal context fixture is missing',
    );
    mounted.editor.view.dispatch(mounted.editor.state.tr.delete(source.position, source.position + source.size));
    const cursor = requireValue(findContainer(mounted.editor, 'cursor'), 'Fallback cursor fixture is missing');
    mounted.editor.commands.setTextSelection(cursor.position + 2);
    const onTransaction = vi.fn();
    mounted.editor.on('transaction', onTransaction);

    expect(createImmediateNodeWorkflow(mounted.editor, 'p5Sketch')(capturedContext)).toBe(true);
    const blocks = containers(mounted.editor.getJSON());
    expect(onTransaction).toHaveBeenCalledTimes(1);
    expect(blocks.map(blockId)).toEqual(['cursor', capturedContext.targetBlockId, 'tail']);
    expect(blocks[1]).toMatchObject({ content: [{ type: 'p5Sketch' }] });
    mounted.destroy();
  });

  it('passes a prefixed file modal its fresh result ID and complete exact-anchor context', () => {
    const mounted = mount(doc([block('file-prefix', 'Hello /file')]));
    const range = slashRange(mounted.editor, 'file-prefix');
    const onFileActivate = vi.fn<(blockId: string, context?: TiptapSlashActionContext) => void>();
    const callback = createFileWorkflow(onFileActivate);
    const file = createTiptapSlashCatalog(messages, {
      capabilities: { file: true },
      callbacks: { file: callback },
    }).find((candidate) => candidate.key === 'file');
    if (!file || !callback) {
      throw new Error('The file slash workflow is missing');
    }

    expect(
      executeTiptapSlashItem({ editor: mounted.editor, item: file, range, callbacks: { file: callback } }),
    ).toMatchObject({ status: 'delegated', editorMutations: 0 });
    const [targetBlockId, captured] = onFileActivate.mock.calls[0] ?? [];
    expect(targetBlockId).toEqual(expect.any(String));
    expect(targetBlockId).not.toBe('file-prefix');
    expect(captured).toMatchObject({
      blockId: 'file-prefix',
      targetBlockId,
      placement: 'after',
      triggerText: '/file',
      range,
    });
    mounted.destroy();
  });

  it('applies a verified slash-only File block to the typed editor transaction', () => {
    const localized = mount(doc([block('file-target', '/file')]));
    const range = slashRange(localized.editor, 'file-target');
    let captured: TiptapSlashActionContext | undefined;
    const callback = createFileWorkflow((_blockId, context) => {
      captured = context;
    });
    const file = createTiptapSlashCatalog(messages, {
      capabilities: { file: true },
      callbacks: { file: callback },
    }).find((candidate) => candidate.key === 'file');
    if (!file || !callback) {
      throw new Error('The file slash workflow is missing');
    }
    executeTiptapSlashItem({ editor: localized.editor, item: file, range, callbacks: { file: callback } });
    const context = requireValue(captured, 'File workflow context is missing');
    const fileBlock = {
      id: context.targetBlockId,
      type: 'file' as const,
      props: { fileId: crypto.randomUUID(), name: 'Document', alt: '', caption: '' },
    };

    expect(applyFileBlockWorkflow(createTiptapEditorGeneration(localized.editor), context, fileBlock)).toBe(true);
    expect(containers(localized.editor.getJSON())).toEqual([
      expect.objectContaining({
        attrs: expect.objectContaining({ id: 'file-target' }),
        content: [expect.objectContaining({ type: 'file' })],
      }),
    ]);
    localized.destroy();
  });

  it('creates a prefixed File sibling with one exact ID', () => {
    const localized = mount(doc([block('file-prefix', 'Hello /file')]));
    const range = slashRange(localized.editor, 'file-prefix');
    let captured: TiptapSlashActionContext | undefined;
    const callback = createFileWorkflow((_blockId, context) => {
      captured = context;
    });
    const file = createTiptapSlashCatalog(messages, {
      capabilities: { file: true },
      callbacks: { file: callback },
    }).find((candidate) => candidate.key === 'file');
    if (!file || !callback) {
      throw new Error('The file slash workflow is missing');
    }
    executeTiptapSlashItem({ editor: localized.editor, item: file, range, callbacks: { file: callback } });
    const context = requireValue(captured, 'File workflow context is missing');
    const fileBlock = {
      id: context.targetBlockId,
      type: 'file' as const,
      props: { fileId: crypto.randomUUID(), name: 'Document', alt: '', caption: '' },
    };

    expect(applyFileBlockWorkflow(createTiptapEditorGeneration(localized.editor), context, fileBlock)).toBe(true);
    expect(containers(localized.editor.getJSON()).map(blockId)).toEqual(['file-prefix', context.targetBlockId]);
    expect(containers(localized.editor.getJSON())[0]).toMatchObject({ content: [{ content: [{ text: 'Hello ' }] }] });
    localized.destroy();
  });

  it('keeps every file from one picker operation on its captured editor generation', () => {
    const targetBlockId = crypto.randomUUID();
    const stale = mount(doc([block(targetBlockId, '/file')]));
    const replacement = mount(doc([block('replacement-target', 'Replacement')]));
    const range = slashRange(stale.editor, targetBlockId);
    let captured: TiptapSlashActionContext | undefined;
    const callback = createFileWorkflow((_blockId, context) => {
      captured = context;
    });
    const file = createTiptapSlashCatalog(messages, {
      capabilities: { file: true },
      callbacks: { file: callback },
    }).find((candidate) => candidate.key === 'file');
    if (!file || !callback) {
      throw new Error('The file slash workflow is missing');
    }
    executeTiptapSlashItem({ editor: stale.editor, item: file, range, callbacks: { file: callback } });
    const context = requireValue(captured, 'File workflow context is missing');
    const editorGeneration = createTiptapEditorGeneration(stale.editor);
    const insert = createFileBlockInsert(
      createFileBlockInsertSession(context, editorGeneration, createTiptapEditorMediaCommandPort(stale.editor), {
        referenceBlockId: targetBlockId,
      }),
    );
    const firstFileId = crypto.randomUUID();
    expect(
      insert(
        { type: 'file', props: { fileId: firstFileId, name: 'First', alt: '', caption: '' } },
        { referenceBlockId: targetBlockId },
      ),
    ).toEqual({ ok: true, blockId: context.targetBlockId });

    stale.destroy();
    const replacementBefore = replacement.editor.getJSON();
    expect(
      insert(
        { type: 'file', props: { fileId: crypto.randomUUID(), name: 'Second', alt: '', caption: '' } },
        { referenceBlockId: context.targetBlockId },
      ),
    ).toEqual({ ok: false, reason: 'unavailable' });
    expect(replacement.editor.getJSON()).toEqual(replacementBefore);
    replacement.destroy();
  });

  it('creates a delegated Map with one exact ID', () => {
    const localized = mount(doc([block('map-prefix', 'Hello /map')]));
    const range = slashRange(localized.editor, 'map-prefix');
    let captured: TiptapSlashActionContext | undefined;
    const callback = (context: TiptapSlashActionContext) => {
      captured = context;
    };
    const map = createTiptapSlashCatalog(messages, {
      capabilities: { map: true },
      callbacks: { map: callback },
    }).find((candidate) => candidate.key === 'map');
    if (!map) {
      throw new Error('The map slash workflow is missing');
    }
    executeTiptapSlashItem({ editor: localized.editor, item: map, range, callbacks: { map: callback } });
    const context = requireValue(captured, 'Map workflow context is missing');
    const mapBlock = createMapBlock('place-1', { lat: 37.5, lng: 127 });
    mapBlock.id = context.targetBlockId;

    expect(applyMapInsertWorkflow(createTiptapEditorGeneration(localized.editor), context, mapBlock)).toBe(true);
    expect(containers(localized.editor.getJSON()).map(blockId)).toEqual(['map-prefix', context.targetBlockId]);
    expect(containers(localized.editor.getJSON())[1]).toMatchObject({
      content: [
        expect.objectContaining({
          type: 'map',
          attrs: expect.objectContaining({ mapPlaceIds: 'place-1', centerLat: '37.5', centerLng: '127' }),
        }),
      ],
    });
    localized.destroy();
  });

  it('rejects a delayed Map result when the locale slash anchor changed', () => {
    const localized = mount(doc([block('map-target', '/map')]));
    const range = slashRange(localized.editor, 'map-target');
    let captured: TiptapSlashActionContext | undefined;
    const callback = (context: TiptapSlashActionContext) => {
      captured = context;
    };
    const map = createTiptapSlashCatalog(messages, {
      capabilities: { map: true },
      callbacks: { map: callback },
    }).find((candidate) => candidate.key === 'map');
    if (!map) {
      throw new Error('The map slash workflow is missing');
    }
    executeTiptapSlashItem({ editor: localized.editor, item: map, range, callbacks: { map: callback } });
    const context = requireValue(captured, 'Map workflow context is missing');
    localized.editor.commands.insertContent(' changed');
    const localizedBefore = localized.editor.getJSON();
    const mapBlock = createMapBlock('place-1', { lat: 37.5, lng: 127 });
    mapBlock.id = context.targetBlockId;

    expect(applyMapInsertWorkflow(createTiptapEditorGeneration(localized.editor), context, mapBlock)).toBe(false);
    expect(localized.editor.getJSON()).toEqual(localizedBefore);
    localized.destroy();
  });

  it('rejects delayed File and Map results after their editor generation is destroyed', () => {
    const localized = mount(doc([block('stale-target', '/file')]));
    const editorGeneration = createTiptapEditorGeneration(localized.editor);
    const context: TiptapSlashActionContext = {
      blockId: 'stale-target',
      targetBlockId: 'stale-target',
      placement: 'replace',
      triggerText: '/file',
      anchorContentJSON: '{}',
      range: { from: 2, to: 7, contentPosition: 2, blockId: 'stale-target' },
    };
    const fileBlock = {
      id: context.targetBlockId,
      type: 'file' as const,
      props: { fileId: crypto.randomUUID(), name: 'Document' },
    };
    const mapBlock = createMapBlock('place-1', { lat: 37.5, lng: 127 });
    mapBlock.id = context.targetBlockId;
    localized.destroy();

    expect(applyFileBlockWorkflow(editorGeneration, context, fileBlock)).toBe(false);
    expect(applyMapInsertWorkflow(editorGeneration, context, mapBlock)).toBe(false);
  });

  it('inserts after the captured block inside its containing nested blockGroup', () => {
    const nestedTarget = block('nested-target', 'Hello /p5');
    const mounted = mount(doc([block('parent', 'Parent', [nestedTarget]), block('outer-tail', 'Outer')]));
    const range = slashRange(mounted.editor, 'nested-target');
    const callback = createImmediateNodeWorkflow(mounted.editor, 'p5Sketch');

    expect(
      executeTiptapSlashItem({ editor: mounted.editor, item: p5Item(callback), range, callbacks: { p5: callback } }),
    ).toMatchObject({ status: 'applied' });
    const top = containers(mounted.editor.getJSON());
    const nested = (top[0] as JSONContent | undefined)?.content?.[1]?.content ?? [];
    expect(top).toHaveLength(2);
    expect(nested).toHaveLength(2);
    expect(nested[0]).toMatchObject({ attrs: { id: 'nested-target' }, content: [{ content: [{ text: 'Hello ' }] }] });
    expect(nested[1]).toMatchObject({ content: [{ type: 'p5Sketch' }] });
    mounted.destroy();
  });
});

function findContainer(editor: Editor, blockId: string): { position: number; size: number } | null {
  let result: { position: number; size: number } | null = null;
  editor.state.doc.descendants((node, position) => {
    if (node.type.name === 'blockContainer' && node.attrs.id === blockId) {
      result = { position, size: node.nodeSize };
      return false;
    }
    return true;
  });
  return result;
}
