import type { Editor } from '@tiptap/core';
import { resolveEditorAuthoringMode } from '@/features/editor/EditorAuthoringMode';
import { Fragment, NodeRange, Slice, type Node as ProseMirrorNode } from '@tiptap/pm/model';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { CellSelection } from '@tiptap/pm/tables';
import { canJoin, liftTarget, ReplaceAroundStep } from '@tiptap/pm/transform';
import { normalizeRichTextHref } from '@echovisionlab/geul-common/editor/link-normalization';
import type { EditorColor } from '@/features/editor/toolbars/EditorColorStyleButton';
import { resolveTiptapAIContext, type TiptapAIContext } from '../ai/tiptap-ai';
import { setCurrentBlockAlignment, type TextAlignment } from '../block-commands';
import { isTextRangeSelection } from '../integration/block-mixed-selection';
import { isSelectionInsideInlineMath, selectionTouchesInlineMath } from '../math/math-selection';

export type SelectionTextStyle = 'bold' | 'italic' | 'underline' | 'strike' | 'code';

export type SelectionBlockType =
  | 'paragraph'
  | 'heading-1'
  | 'heading-2'
  | 'heading-3'
  | 'bulletListItem'
  | 'numberedListItem'
  | 'checkListItem'
  | 'quote'
  | 'codeBlock';

export const SELECTION_BLOCK_TYPES: readonly SelectionBlockType[] = [
  'paragraph',
  'heading-1',
  'heading-2',
  'heading-3',
  'bulletListItem',
  'numberedListItem',
  'checkListItem',
  'quote',
  'codeBlock',
];

export interface SelectionBubbleMenuState {
  blockType: SelectionBlockType | null;
  canChangeBlockType: boolean;
  activeTextStyles: ReadonlySet<SelectionTextStyle>;
  /** Null when the selected targets do not share one alignment. */
  alignment: TextAlignment | null;
  canAlign: boolean;
  canFormatText: boolean;
  canColor: boolean;
  textColor: EditorColor;
  backgroundColor: EditorColor;
  canNest: boolean;
  canUnnest: boolean;
  linkHref: string | null;
  linkSelection: SelectionRangeSnapshot | null;
  canConvertToInlineMath: boolean;
  canOpenAI: boolean;
  hasTextSelection: boolean;
  hasSafeInlineSelection: boolean;
  inlineCodeActive: boolean;
  selectedText: string;
}

export interface SelectionLinkUpdate {
  href: string;
  text?: string;
}

export interface SelectionRangeSnapshot {
  from: number;
  to: number;
  expectedText?: string;
}

export interface SelectionBubbleMenuCommandOptions {
  onAIActivate?: (context: TiptapAIContext) => void;
  onOpenLink?: (href: string) => void;
}

export interface SelectionBubbleMenuCommands extends SelectionBubbleMenuState {
  setBlockType: (type: SelectionBlockType) => boolean;
  toggleTextStyle: (style: SelectionTextStyle) => boolean;
  setAlignment: (alignment: TextAlignment) => boolean;
  setTextColor: (color: EditorColor) => boolean;
  setBackgroundColor: (color: EditorColor) => boolean;
  nest: () => boolean;
  unnest: () => boolean;
  createLink: (input: SelectionLinkUpdate, snapshot?: SelectionRangeSnapshot) => boolean;
  editLink: (input: SelectionLinkUpdate, snapshot?: SelectionRangeSnapshot) => boolean;
  openLink: () => boolean;
  removeLink: () => boolean;
  convertToInlineMath: () => boolean;
  openAI: () => boolean;
}

interface CurrentBlockContext {
  content: ProseMirrorNode;
  contentPosition: number;
}

interface ActiveLinkRange extends SelectionRangeSnapshot {
  href: string;
  text: string;
}

const TEXT_STYLES: readonly SelectionTextStyle[] = ['bold', 'italic', 'underline', 'strike', 'code'];
const EDITOR_COLORS = new Set<EditorColor>([
  'default',
  'gray',
  'brown',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
]);

function currentBlockContext(editor: Editor): CurrentBlockContext | null {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name !== 'blockContainer') {
      continue;
    }
    const content = node.firstChild;
    if (!content) {
      return null;
    }
    const containerPosition = $from.before(depth);
    return {
      content,
      contentPosition: containerPosition + 1,
    };
  }
  return null;
}

function selectionBlockRange(editor: Editor) {
  const { $from, $to } = editor.state.selection;
  return $from.blockRange($to, (node) => node.childCount > 0 && node.type.name === 'blockGroup');
}

function isCodeBlockContext(editor: Editor): boolean {
  const { $from, $to } = editor.state.selection;
  const hasCodeAncestor = [$from, $to].some(($position) => {
    for (let depth = $position.depth; depth >= 0; depth -= 1) {
      if ($position.node(depth).type.name === 'codeBlock') {
        return true;
      }
    }
    return false;
  });
  return hasCodeAncestor;
}

function isNonEmptyTextSelection(editor: Editor): boolean {
  const { selection } = editor.state;
  return (
    isTextRangeSelection(selection) &&
    !selection.empty &&
    editor.state.doc.textBetween(selection.from, selection.to, '\n', '\n').trim().length > 0
  );
}

function isSafeInlineSelection(editor: Editor): boolean {
  const { selection } = editor.state;
  return (
    isNonEmptyTextSelection(editor) &&
    selection instanceof TextSelection &&
    !selectionTouchesInlineMath(selection) &&
    selection.$from.parent === selection.$to.parent &&
    selection.$from.parent.isTextblock
  );
}

function canUseEditor(editor: Editor): boolean {
  return !editor.isDestroyed && editor.isEditable && !editor.view.composing;
}

function canEditLocalized(editor: Editor): boolean {
  return canUseEditor(editor) && resolveEditorAuthoringMode(editor).allowLocalizedBlockEdits;
}

function canEditNeutral(editor: Editor): boolean {
  return canUseEditor(editor) && resolveEditorAuthoringMode(editor).allowNeutralBlockEdits;
}

function intersectedContentNodes(editor: Editor): ProseMirrorNode[] {
  const { doc, selection } = editor.state;
  const nodes: ProseMirrorNode[] = [];
  doc.descendants((node, position) => {
    if (node.type.name !== 'blockContainer' || !node.firstChild) {
      return true;
    }
    const start = position + 1;
    const end = start + node.firstChild.nodeSize;
    if (selection.from < end && selection.to > start) {
      nodes.push(node.firstChild);
    }
    return true;
  });
  return nodes;
}

function selectionCapabilities(editor: Editor): { canAlign: boolean; canFormatText: boolean; canColor: boolean } {
  const { selection } = editor.state;
  if (selection instanceof CellSelection) {
    const cells: ProseMirrorNode[] = [];
    selection.forEachCell((node) => cells.push(node));
    return {
      canAlign: cells.length > 0 && cells.every((node) => Boolean(node.type.spec.attrs?.textAlignment)),
      canFormatText: false,
      canColor: false,
    };
  }
  const touchesInlineMath = selectionTouchesInlineMath(selection);
  if (selection instanceof TextSelection) {
    const cellNames = new Set(['tableCell', 'tableHeader']);
    let cell: ProseMirrorNode | null = null;
    for (let depth = selection.$from.depth; depth > 0; depth -= 1) {
      const node = selection.$from.node(depth);
      if (cellNames.has(node.type.name)) {
        cell = node;
        break;
      }
    }
    const sameTextblock = selection.$from.parent === selection.$to.parent && selection.$from.parent.isTextblock;
    if (cell && sameTextblock) {
      const canFormatText =
        !touchesInlineMath && isNonEmptyTextSelection(editor) && selection.$from.parent.type.name !== 'codeBlock';
      return {
        canAlign: Boolean(cell.type.spec.attrs?.textAlignment),
        canFormatText,
        canColor: canFormatText,
      };
    }
  }
  const contents = intersectedContentNodes(editor);
  const canFormatText =
    !touchesInlineMath &&
    isNonEmptyTextSelection(editor) &&
    contents.length > 0 &&
    contents.every((node) => node.isTextblock && node.type.name !== 'codeBlock');
  return {
    canAlign: contents.length > 0 && contents.every((node) => Boolean(node.type.spec.attrs?.textAlignment)),
    canFormatText,
    canColor: canFormatText,
  };
}

/** Pure visibility policy shared by the BubbleMenu host and unit tests. */
export function canShowSelectionBubbleMenu(editor: Editor): boolean {
  return (
    !editor.isDestroyed &&
    editor.isEditable &&
    !editor.view.composing &&
    !isSelectionInsideInlineMath(editor.state.selection) &&
    (isNonEmptyTextSelection(editor) || Boolean(activeLinkRange(editor))) &&
    !(editor.state.selection instanceof NodeSelection) &&
    !isCodeBlockContext(editor)
  );
}

function normalizeBlockType(content: ProseMirrorNode): SelectionBlockType | null {
  if (content.type.name === 'heading') {
    const level = Number(content.attrs.level);
    return level === 2 ? 'heading-2' : level === 3 ? 'heading-3' : 'heading-1';
  }
  return SELECTION_BLOCK_TYPES.includes(content.type.name as SelectionBlockType)
    ? (content.type.name as SelectionBlockType)
    : null;
}

function resolvedColor(editor: Editor, markName: 'textColor' | 'backgroundColor'): EditorColor {
  const value = String(editor.getAttributes(markName).stringValue ?? 'default') as EditorColor;
  return EDITOR_COLORS.has(value) ? value : 'default';
}

function canNestBlock(editor: Editor): boolean {
  const range = selectionBlockRange(editor);
  return Boolean(
    range && range.startIndex > 0 && range.parent.child(range.startIndex - 1).type.name === 'blockContainer',
  );
}

function canUnnestBlock(editor: Editor): boolean {
  const range = selectionBlockRange(editor);
  const itemType = editor.schema.nodes.blockContainer;
  return Boolean(range && itemType && range.depth > 0 && range.$from.node(range.depth - 1).type === itemType);
}

function activeLinkRange(editor: Editor): ActiveLinkRange | null {
  const markType = editor.schema.marks.link;
  const { selection } = editor.state;
  if (!markType || !editor.isActive('link')) {
    return null;
  }
  const href = String(editor.getAttributes('link').href ?? '').trim();
  if (!href) {
    return null;
  }
  if (!selection.empty) {
    return {
      from: selection.from,
      to: selection.to,
      href,
      text: editor.state.doc.textBetween(selection.from, selection.to, '\n', '\n'),
    };
  }
  const { $from } = selection;
  const parentStart = $from.start();
  const cursorOffset = $from.parentOffset;
  let start = -1;
  let end = -1;
  let active = false;
  $from.parent.forEach((node, offset) => {
    const hasLink = node.marks.some((mark) => mark.type === markType && mark.attrs.href === href);
    if (hasLink && (offset <= cursorOffset || active)) {
      if (!active) {
        start = parentStart + offset;
        active = true;
      }
      end = parentStart + offset + node.nodeSize;
    } else if (active) {
      active = false;
    }
  });
  return start >= 0 && end > start
    ? { from: start, to: end, href, text: editor.state.doc.textBetween(start, end, '\n', '\n') }
    : null;
}

function canConvertToInlineMath(editor: Editor): boolean {
  const text = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, '\n', '\n');
  return Boolean(editor.schema.nodes.mathInline && text.trim() && !text.includes('\n'));
}

function alignmentState(
  editor: Editor,
  context: CurrentBlockContext | null,
): {
  alignment: TextAlignment | null;
  supported: boolean;
} {
  const normalize = (value: unknown): TextAlignment => {
    const alignment = String(value ?? 'left');
    return alignment === 'center' || alignment === 'right' ? alignment : 'left';
  };
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
      return {
        alignment: normalize(node.attrs.textAlignment),
        supported: Boolean(node.type.spec.attrs?.textAlignment),
      };
    }
  }
  const targets = intersectedContentNodes(editor);
  const alignments = new Set(targets.map((node) => normalize(node.attrs.textAlignment)));
  return {
    alignment:
      alignments.size > 1
        ? null
        : (alignments.values().next().value ?? normalize(context?.content.attrs.textAlignment)),
    supported: Boolean(context?.content.type.spec.attrs?.textAlignment),
  };
}

function canOpenAI(editor: Editor, onAIActivate: SelectionBubbleMenuCommandOptions['onAIActivate']): boolean {
  if (!onAIActivate) {
    return false;
  }
  try {
    return resolveTiptapAIContext(editor).isSupported;
  } catch {
    return false;
  }
}

const ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/** Applies the Geul rich-text protocol policy. */
export function normalizeSelectionLinkHref(value: string): string | null {
  const trimmed = normalizeRichTextHref(value).trim();
  const hasControlCharacter = Array.from(trimmed).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint != null && (codePoint <= 0x1f || codePoint === 0x7f);
  });
  if (!trimmed || hasControlCharacter || /\s/u.test(trimmed)) {
    return null;
  }
  if (/^\{\{[^{}]+\}\}$/u.test(trimmed)) {
    return trimmed;
  }
  if (
    (trimmed.startsWith('/') && !trimmed.startsWith('//')) ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('?')
  ) {
    return trimmed;
  }
  const candidate = /^[a-z][a-z0-9+.-]*:/iu.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    return ALLOWED_LINK_PROTOCOLS.has(parsed.protocol.toLocaleLowerCase()) ? candidate : null;
  } catch {
    return null;
  }
}

export function resolveSelectionBubbleMenuState(
  editor: Editor,
  options: SelectionBubbleMenuCommandOptions = {},
): SelectionBubbleMenuState {
  const context = currentBlockContext(editor);
  const activeTextStyles = new Set(TEXT_STYLES.filter((style) => editor.isActive(style)));
  const alignment = alignmentState(editor, context);
  const hasTextSelection = isNonEmptyTextSelection(editor);
  const hasSafeInlineSelection = isSafeInlineSelection(editor);
  const link = activeLinkRange(editor);
  const capabilities = selectionCapabilities(editor);
  const localizedEditable = canEditLocalized(editor);
  const neutralEditable = canEditNeutral(editor);
  return {
    blockType: context ? normalizeBlockType(context.content) : null,
    canChangeBlockType: Boolean(
      neutralEditable && hasSafeInlineSelection && context?.content.isTextblock && normalizeBlockType(context.content),
    ),
    activeTextStyles,
    alignment: alignment.alignment,
    canAlign: neutralEditable && hasTextSelection && alignment.supported && capabilities.canAlign,
    canFormatText: localizedEditable && capabilities.canFormatText,
    canColor: localizedEditable && capabilities.canColor,
    textColor: resolvedColor(editor, 'textColor'),
    backgroundColor: resolvedColor(editor, 'backgroundColor'),
    canNest: Boolean(neutralEditable && hasSafeInlineSelection && context?.content.isTextblock && canNestBlock(editor)),
    canUnnest: Boolean(
      neutralEditable && hasSafeInlineSelection && context?.content.isTextblock && canUnnestBlock(editor),
    ),
    linkHref: link?.href ?? null,
    linkSelection: link ? { from: link.from, to: link.to, expectedText: link.text } : null,
    canConvertToInlineMath:
      localizedEditable &&
      hasSafeInlineSelection &&
      capabilities.canFormatText &&
      !editor.isActive('code') &&
      canConvertToInlineMath(editor),
    canOpenAI:
      localizedEditable &&
      hasSafeInlineSelection &&
      capabilities.canFormatText &&
      !editor.isActive('code') &&
      canOpenAI(editor, options.onAIActivate),
    hasTextSelection,
    hasSafeInlineSelection,
    inlineCodeActive: editor.isActive('code'),
    selectedText:
      link?.text ??
      (hasTextSelection
        ? editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, '\n', '\n')
        : ''),
  };
}

function focusEditor(editor: Editor) {
  if (!editor.isDestroyed) {
    editor.view.focus();
  }
}

function setBlockType(editor: Editor, type: SelectionBlockType): boolean {
  if (!canEditNeutral(editor) || !isSafeInlineSelection(editor)) {
    return false;
  }
  const context = currentBlockContext(editor);
  if (!context?.content.isTextblock) {
    return false;
  }
  const heading = type.startsWith('heading-');
  const nodeName = heading ? 'heading' : type;
  const nodeType = editor.schema.nodes[nodeName];
  if (!nodeType) {
    return false;
  }
  const attributes: Record<string, unknown> = {};
  for (const key of Object.keys(nodeType.spec.attrs ?? {})) {
    if (key in context.content.attrs) {
      attributes[key] = context.content.attrs[key];
    }
  }
  if (heading) {
    attributes.level = Number(type.slice(-1));
  }
  try {
    const transaction = editor.state.tr.setNodeMarkup(context.contentPosition, nodeType, attributes);
    editor.view.dispatch(transaction.scrollIntoView());
    focusEditor(editor);
    return true;
  } catch {
    return false;
  }
}

function setColor(editor: Editor, markName: 'textColor' | 'backgroundColor', color: EditorColor): boolean {
  if (!canEditLocalized(editor) || !selectionCapabilities(editor).canColor) {
    return false;
  }
  const mark = editor.schema.marks[markName];
  const { selection } = editor.state;
  if (!mark || selection.empty) {
    return false;
  }
  const transaction = editor.state.tr.removeMark(selection.from, selection.to, mark);
  if (color !== 'default') {
    transaction.addMark(selection.from, selection.to, mark.create({ stringValue: color }));
  }
  editor.view.dispatch(transaction.scrollIntoView());
  focusEditor(editor);
  return true;
}

function updateLink(editor: Editor, input: SelectionLinkUpdate | null, snapshot?: SelectionRangeSnapshot): boolean {
  const liveLinkRange = activeLinkRange(editor);
  if (
    !canEditLocalized(editor) ||
    (input && !liveLinkRange && (!isSafeInlineSelection(editor) || editor.isActive('code')))
  ) {
    return false;
  }
  const mark = editor.schema.marks.link;
  const liveSelection = isSafeInlineSelection(editor)
    ? { from: editor.state.selection.from, to: editor.state.selection.to }
    : null;
  const range = liveLinkRange ?? liveSelection;
  if (!mark || !range) {
    return false;
  }
  if (input && !liveLinkRange && !liveSelection) {
    return false;
  }
  if (snapshot && (snapshot.from !== range.from || snapshot.to !== range.to)) {
    return false;
  }
  if (
    snapshot?.expectedText !== undefined &&
    editor.state.doc.textBetween(snapshot.from, snapshot.to, '\n', '\n') !== snapshot.expectedText
  ) {
    return false;
  }
  const href = input ? normalizeSelectionLinkHref(input.href) : null;
  if (input && !href) {
    return false;
  }
  const transaction = editor.state.tr.removeMark(range.from, range.to, mark);
  const currentText = editor.state.doc.textBetween(range.from, range.to, '\n', '\n');
  if (input && typeof input.text === 'string' && input.text.trim() && input.text !== currentText) {
    const existingMarks = editor.state.doc
      .resolve(range.from)
      .marks()
      .filter((existing) => existing.type !== mark);
    const text = editor.schema.text(input.text, href ? [...existingMarks, mark.create({ href })] : existingMarks);
    transaction.replaceWith(range.from, range.to, text);
    transaction.setSelection(TextSelection.create(transaction.doc, range.from, range.from + text.nodeSize));
  } else if (href) {
    transaction.addMark(range.from, range.to, mark.create({ href }));
    transaction.setSelection(TextSelection.create(transaction.doc, range.from, range.to));
  }
  editor.view.dispatch(transaction.scrollIntoView());
  focusEditor(editor);
  return true;
}

function nestBlock(editor: Editor): boolean {
  if (!canEditNeutral(editor) || !isSafeInlineSelection(editor)) {
    return false;
  }
  const itemType = editor.schema.nodes.blockContainer;
  const groupType = editor.schema.nodes.blockGroup;
  const range = selectionBlockRange(editor);
  if (!itemType || !groupType || !range || range.startIndex === 0) {
    return false;
  }
  const nodeBefore = range.parent.child(range.startIndex - 1);
  if (nodeBefore.type !== itemType) {
    return false;
  }
  const nestedBefore = nodeBefore.lastChild?.type === groupType;
  const inner = Fragment.from(nestedBefore ? itemType.create() : null);
  const slice = new Slice(
    Fragment.from(itemType.create(null, Fragment.from(groupType.create(null, inner)))),
    nestedBefore ? 3 : 1,
    0,
  );
  const transaction = editor.state.tr.step(
    new ReplaceAroundStep(range.start - (nestedBefore ? 3 : 1), range.end, range.start, range.end, slice, 1, true),
  );
  editor.view.dispatch(transaction.scrollIntoView());
  focusEditor(editor);
  return true;
}

function liftToOuterGroup(editor: Editor, range: NodeRange): boolean {
  const itemType = editor.schema.nodes.blockContainer;
  const groupType = editor.schema.nodes.blockGroup;
  if (!itemType || !groupType) {
    return false;
  }
  const transaction = editor.state.tr;
  const end = range.end;
  const endOfGroup = range.$to.end(range.depth);
  let liftedRange = range;
  if (end < endOfGroup) {
    const blockBeingLifted = range.parent.child(range.endIndex - 1);
    const nestedAfter = blockBeingLifted.lastChild?.type === groupType;
    transaction.step(
      new ReplaceAroundStep(
        end - (nestedAfter ? 2 : 1),
        endOfGroup,
        end,
        endOfGroup,
        new Slice(Fragment.from(itemType.create(null, groupType.create())), nestedAfter ? 2 : 1, 0),
        nestedAfter ? 0 : 1,
        true,
      ),
    );
    liftedRange = new NodeRange(
      transaction.doc.resolve(range.$from.pos),
      transaction.doc.resolve(endOfGroup),
      range.depth,
    );
  }
  const target = liftTarget(liftedRange);
  if (target == null) {
    return false;
  }
  transaction.lift(liftedRange, target);
  const afterPosition = transaction.mapping.map(end, -1) - 1;
  if (afterPosition > 0) {
    const $after = transaction.doc.resolve(afterPosition);
    if (canJoin(transaction.doc, $after.pos) && $after.nodeBefore?.type === $after.nodeAfter?.type) {
      transaction.join($after.pos);
    }
  }
  editor.view.dispatch(transaction.scrollIntoView());
  focusEditor(editor);
  return true;
}

function unnestBlock(editor: Editor): boolean {
  if (!canEditNeutral(editor) || !isSafeInlineSelection(editor)) {
    return false;
  }
  const range = selectionBlockRange(editor);
  const itemType = editor.schema.nodes.blockContainer;
  if (!range || !itemType || range.$from.node(range.depth - 1).type !== itemType) {
    return false;
  }
  return liftToOuterGroup(editor, range);
}

function convertToInlineMath(editor: Editor): boolean {
  if (
    !canEditLocalized(editor) ||
    !isSafeInlineSelection(editor) ||
    editor.isActive('code') ||
    !selectionCapabilities(editor).canFormatText ||
    !canConvertToInlineMath(editor)
  ) {
    return false;
  }
  const { from, to } = editor.state.selection;
  const source = editor.state.doc.textBetween(from, to, '\n', '\n');
  const mathInline = editor.schema.nodes.mathInline;
  const inlineNode = mathInline.create(null, editor.state.schema.text(source));
  const transaction = editor.state.tr.replaceWith(from, to, inlineNode);
  transaction.setSelection(TextSelection.create(transaction.doc, from + 1, from + 1 + source.length));
  editor.view.dispatch(transaction.scrollIntoView());
  focusEditor(editor);
  return true;
}

function openLink(href: string, callback?: (href: string) => void): boolean {
  const normalized = normalizeSelectionLinkHref(href);
  if (!normalized) {
    return false;
  }
  if (callback) {
    callback(normalized);
    return true;
  }
  if (typeof window === 'undefined') {
    return false;
  }
  window.open(normalized, '_blank', 'noopener,noreferrer');
  return true;
}

/**
 * The view only invokes this adapter. Block tree mutations, marks, link, math,
 * and AI selection resolution stay centralized here instead of being recreated
 * in individual buttons.
 */
export function createSelectionBubbleMenuCommands(
  editor: Editor,
  options: SelectionBubbleMenuCommandOptions = {},
): SelectionBubbleMenuCommands {
  const state = resolveSelectionBubbleMenuState(editor, options);
  return {
    ...state,
    setBlockType: (type) => setBlockType(editor, type),
    toggleTextStyle: (style) => {
      if (!canEditLocalized(editor) || !selectionCapabilities(editor).canFormatText) {
        return false;
      }
      const result = editor.chain().focus().toggleMark(style).run();
      return result;
    },
    setAlignment: (alignment) =>
      canEditNeutral(editor) &&
      isNonEmptyTextSelection(editor) &&
      selectionCapabilities(editor).canAlign &&
      setCurrentBlockAlignment(editor, alignment),
    setTextColor: (color) => !editor.isActive('code') && setColor(editor, 'textColor', color),
    setBackgroundColor: (color) => !editor.isActive('code') && setColor(editor, 'backgroundColor', color),
    nest: () => nestBlock(editor),
    unnest: () => unnestBlock(editor),
    createLink: (input, snapshot) => updateLink(editor, input, snapshot),
    editLink: (input, snapshot) => updateLink(editor, input, snapshot),
    openLink: () => openLink(state.linkHref ?? '', options.onOpenLink),
    removeLink: () => updateLink(editor, null, activeLinkRange(editor) ?? undefined),
    convertToInlineMath: () => convertToInlineMath(editor),
    openAI: () => {
      if (
        !canEditLocalized(editor) ||
        !isSafeInlineSelection(editor) ||
        editor.isActive('code') ||
        !selectionCapabilities(editor).canFormatText ||
        !options.onAIActivate
      ) {
        return false;
      }
      const context = resolveTiptapAIContext(editor);
      if (!context.isSupported) {
        return false;
      }
      options.onAIActivate(context);
      return true;
    },
  };
}
