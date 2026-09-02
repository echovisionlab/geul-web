import { Extension } from '@tiptap/core';
import { Fragment, Slice, type Node as ProseMirrorNode, type Schema } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { selectionTouchesInlineMath } from './math-selection';

const MATH_PATTERNS = [
  /\$\$([^$\n]+)\$\$/g,
  /\\\[([^\]]+)\\\]/g,
  /(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g,
  /\\\(([^)\n]+)\\\)/g,
];

function replaceMathText(node: ProseMirrorNode, schema: Schema): Fragment {
  if (node.type.name === 'mathInline') {
    return Fragment.from(node);
  }
  if (!node.isText || !node.text) {
    return node.content.size
      ? Fragment.from(node.copy(normalizeMathFragment(node.content, schema)))
      : Fragment.from(node);
  }
  const mathInline = schema.nodes.mathInline;
  if (!mathInline) {
    return Fragment.from(node);
  }
  const matches: Array<{ from: number; to: number; latex: string }> = [];
  for (const pattern of MATH_PATTERNS) {
    pattern.lastIndex = 0;
    for (let match = pattern.exec(node.text); match; match = pattern.exec(node.text)) {
      const latex = match[1]?.trim();
      if (latex) {
        matches.push({ from: match.index, to: match.index + match[0].length, latex });
      }
    }
  }
  matches.sort((left, right) => left.from - right.from || right.to - left.to);
  const nonOverlapping: typeof matches = [];
  let lastAcceptedEnd = -1;
  for (const match of matches) {
    if (match.from < lastAcceptedEnd) {
      continue;
    }
    nonOverlapping.push(match);
    lastAcceptedEnd = match.to;
  }
  if (!nonOverlapping.length) {
    return Fragment.from(node);
  }
  const content: ProseMirrorNode[] = [];
  let offset = 0;
  for (const match of nonOverlapping) {
    if (match.from > offset) {
      content.push(schema.text(node.text.slice(offset, match.from), node.marks));
    }
    content.push(mathInline.create(null, schema.text(match.latex)));
    offset = match.to;
  }
  if (offset < node.text.length) {
    content.push(schema.text(node.text.slice(offset), node.marks));
  }
  return Fragment.from(content);
}

export function normalizeMathFragment(fragment: Fragment, schema: Schema): Fragment {
  if (!schema.nodes.mathInline) {
    return fragment;
  }
  const normalized: ProseMirrorNode[] = [];
  fragment.forEach((node) => {
    replaceMathText(node, schema).forEach((replacement) => normalized.push(replacement));
  });
  return Fragment.from(normalized);
}

export const TiptapMathClipboard = Extension.create({
  name: 'tiptapMathClipboard',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('tiptapMathClipboard'),
        props: {
          transformPasted: (slice, view) => {
            return selectionTouchesInlineMath(view.state.selection)
              ? slice
              : new Slice(normalizeMathFragment(slice.content, this.editor.schema), slice.openStart, slice.openEnd);
          },
        },
      }),
    ];
  },
});
