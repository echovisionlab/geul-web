'use client';

import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import { pickSharedRichTextBlockProps } from '@echovisionlab/geul-common/collaboration/page';
import { createTiptapExtension, type TiptapExtensionInstance } from '@/lib/editor/extensions/tiptap';

let translationStructureSyncDepth = 0;

export function runWithTranslationStructureSync<T>(callback: () => T): T {
  translationStructureSyncDepth += 1;
  try {
    return callback();
  } finally {
    translationStructureSyncDepth = Math.max(0, translationStructureSyncDepth - 1);
  }
}

function isStructuredBlockNode(node: ProseMirrorNode): boolean {
  return node.type.name === 'blockContainer';
}

function resolveBlockSignatureType(node: ProseMirrorNode): string {
  const attrTypeCandidates = [node.attrs?.type, node.attrs?.blockType, node.attrs?.contentType].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );

  return attrTypeCandidates[0] ?? node.firstChild?.type.name ?? node.type.name;
}

function blockContentNode(container: ProseMirrorNode): ProseMirrorNode {
  const firstChild = container.firstChild;
  return firstChild && !firstChild.isText ? firstChild : container;
}

function tableStructureValue(node: ProseMirrorNode): unknown {
  return {
    type: node.type.name,
    attrs: node.attrs,
    content: node.isText || node.isTextblock ? undefined : node.content.content.map(tableStructureValue),
  };
}

function sharedBlockValue(container: ProseMirrorNode): unknown {
  const content = blockContentNode(container);
  const type = resolveBlockSignatureType(container);
  return {
    props: pickSharedRichTextBlockProps(content.attrs, type),
    content:
      type === 'table'
        ? tableStructureValue(content)
        : type === 'p5Sketch' || type === 'threeScene' || type === 'shader'
          ? (content.toJSON().content ?? [])
          : undefined,
  };
}

function resolveParentBlockId(doc: ProseMirrorNode, pos: number): string | null {
  const $pos = doc.resolve(Math.min(pos + 1, doc.content.size));

  for (let depth = $pos.depth - 1; depth >= 0; depth -= 1) {
    const ancestor = $pos.node(depth);
    if (!isStructuredBlockNode(ancestor)) {
      continue;
    }

    const ancestorId = ancestor.attrs?.id;
    if (typeof ancestorId === 'string' && ancestorId.length > 0) {
      return ancestorId;
    }
  }

  return null;
}

function collectBlockStructureSignature(doc: ProseMirrorNode): string[] {
  const signature: string[] = [];

  doc.descendants((node, pos, _parent, index) => {
    if (!isStructuredBlockNode(node)) {
      return true;
    }

    const nodeId = typeof node.attrs?.id === 'string' && node.attrs.id.length > 0 ? node.attrs.id : `@${pos}`;

    signature.push(
      [
        nodeId,
        resolveParentBlockId(doc, pos) ?? 'root',
        String(index ?? 0),
        resolveBlockSignatureType(node),
        JSON.stringify(sharedBlockValue(node)),
      ].join(':'),
    );

    return true;
  });

  return signature;
}

function isCollaborationSyncTransaction(transaction: Transaction): boolean {
  return Boolean(transaction.getMeta('y-sync$'));
}

function isTranslationStructureSyncTransaction(): boolean {
  return translationStructureSyncDepth > 0;
}

export function shouldAllowTranslationStructureTransaction(
  transaction: Pick<Transaction, 'doc' | 'docChanged' | 'getMeta'>,
  previousDoc: ProseMirrorNode,
): boolean {
  if (!transaction.docChanged) {
    return true;
  }

  if (isCollaborationSyncTransaction(transaction as Transaction)) {
    return true;
  }

  if (isTranslationStructureSyncTransaction()) {
    return true;
  }

  const previousSignature = collectBlockStructureSignature(previousDoc);
  const nextSignature = collectBlockStructureSignature(transaction.doc);

  if (previousSignature.length !== nextSignature.length) {
    return false;
  }

  return previousSignature.every((entry, index) => entry === nextSignature[index]);
}

function isEmptyParagraphBlock(node: ProseMirrorNode): boolean {
  return resolveBlockSignatureType(node) === 'paragraph' && node.textContent.trim().length === 0;
}

export function findTrailingEmptyParagraphRange(doc: ProseMirrorNode): { from: number; to: number } | null {
  const topLevelBlocks: Array<{ from: number; to: number; node: ProseMirrorNode }> = [];

  doc.descendants((node, pos) => {
    if (!isStructuredBlockNode(node)) {
      return true;
    }

    if (resolveParentBlockId(doc, pos) !== null) {
      return true;
    }

    topLevelBlocks.push({
      from: pos,
      to: pos + node.nodeSize,
      node,
    });
    return true;
  });

  const trailingTopLevelBlock = topLevelBlocks.at(-1);
  if (trailingTopLevelBlock == null || !isEmptyParagraphBlock(trailingTopLevelBlock.node)) {
    return null;
  }

  return {
    from: trailingTopLevelBlock.from,
    to: trailingTopLevelBlock.to,
  };
}

const BLOCKED_TRANSLATION_BEFOREINPUT_TYPES = new Set(['insertParagraph']);

export function shouldBlockTranslationBeforeInput(inputType: string | null | undefined): boolean {
  if (!inputType) {
    return false;
  }

  return BLOCKED_TRANSLATION_BEFOREINPUT_TYPES.has(inputType);
}

export function shouldBlockTranslationStructureKey(
  event: Pick<KeyboardEvent, 'key' | 'altKey' | 'shiftKey' | 'metaKey' | 'ctrlKey' | 'isComposing'>,
): boolean {
  if (event.isComposing) {
    return false;
  }

  if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
    return true;
  }

  if (event.altKey && event.shiftKey) {
    return (
      event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight'
    );
  }

  return false;
}

function preventDefaultAndStop(event: Event): true {
  event.preventDefault();
  event.stopPropagation();
  return true;
}

function handleTranslationKeyDown(_view: EditorView, event: KeyboardEvent): boolean {
  if (!shouldBlockTranslationStructureKey(event)) {
    return false;
  }

  return preventDefaultAndStop(event);
}

function handleTranslationBeforeInput(_view: EditorView, event: InputEvent): boolean {
  if (!shouldBlockTranslationBeforeInput(event.inputType)) {
    return false;
  }

  return preventDefaultAndStop(event);
}

export const TranslationStructureLockExtension: TiptapExtensionInstance = createTiptapExtension({
  name: 'translationStructureLock',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('translationStructureLock'),
        filterTransaction: (transaction, state) => {
          return shouldAllowTranslationStructureTransaction(transaction, state.doc);
        },
        props: {
          handleKeyDown: handleTranslationKeyDown,
          handleDOMEvents: {
            beforeinput: handleTranslationBeforeInput,
          },
          decorations(state) {
            const range = findTrailingEmptyParagraphRange(state.doc);
            if (range == null) {
              return null;
            }

            return DecorationSet.create(state.doc, [
              Decoration.node(range.from, range.to, {
                class: 'translation-hidden-trailing-paragraph',
                'data-translation-hidden-trailing-paragraph': 'true',
              }),
            ]);
          },
        },
      }),
    ];
  },
});
