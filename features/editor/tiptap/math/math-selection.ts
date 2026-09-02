import type { ResolvedPos } from '@tiptap/pm/model';
import type { Selection } from '@tiptap/pm/state';

function hasInlineMathAncestor(position: ResolvedPos): boolean {
  for (let depth = position.depth; depth > 0; depth -= 1) {
    if (position.node(depth).type.name === 'mathInline') {
      return true;
    }
  }
  return false;
}

export function isSelectionInsideInlineMath(selection: Selection): boolean {
  return hasInlineMathAncestor(selection.$from) || hasInlineMathAncestor(selection.$to);
}

export function selectionTouchesInlineMath(selection: Selection): boolean {
  if (isSelectionInsideInlineMath(selection)) {
    return true;
  }
  if (selection.empty) {
    return false;
  }
  let touchesInlineMath = false;
  selection.$from.doc.nodesBetween(selection.from, selection.to, (node) => {
    if (node.type.name === 'mathInline') {
      touchesInlineMath = true;
      return false;
    }
    return !touchesInlineMath;
  });
  return touchesInlineMath;
}
