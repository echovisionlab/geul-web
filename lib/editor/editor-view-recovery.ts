/** Best-effort DOM selection and scroll handoff when a room swaps its editor binding. */
export function captureEditorViewRecovery(ownerDocument: Document = document): (() => void) | null {
  const selection = ownerDocument.getSelection();
  const active = ownerDocument.activeElement;
  const editable = active instanceof HTMLElement ? active.closest<HTMLElement>('[contenteditable="true"]') : null;
  if (
    !editable ||
    !selection?.anchorNode ||
    !selection.focusNode ||
    !editable.contains(selection.anchorNode) ||
    !editable.contains(selection.focusNode)
  ) {
    return null;
  }
  const editors = [...ownerDocument.querySelectorAll<HTMLElement>('[contenteditable="true"]')];
  const index = editors.indexOf(editable);
  const offset = (node: Node, position: number) => {
    const range = ownerDocument.createRange();
    range.selectNodeContents(editable);
    range.setEnd(node, position);
    return range.toString().length;
  };
  const anchor = offset(selection.anchorNode, selection.anchorOffset);
  const focus = offset(selection.focusNode, selection.focusOffset);
  const scroll: Array<{ element: HTMLElement; top: number; left: number }> = [];
  for (let element = editable.parentElement; element; element = element.parentElement) {
    scroll.push({ element, top: element.scrollTop, left: element.scrollLeft });
  }
  return () => {
    const next = ownerDocument.querySelectorAll<HTMLElement>('[contenteditable="true"]')[index];
    if (!next) {
      return;
    }
    // Do not steal focus if the user moved elsewhere while the binding was replaced.
    const current = ownerDocument.activeElement;
    if (current && current !== ownerDocument.body && current !== editable && current !== next) {
      return;
    }
    const point = (target: number): [Node, number] => {
      const walker = ownerDocument.createTreeWalker(next, NodeFilter.SHOW_TEXT);
      let remaining = target;
      let last: Node = next;
      while (walker.nextNode()) {
        last = walker.currentNode;
        const length = last.textContent?.length ?? 0;
        if (remaining <= length) {
          return [last, remaining];
        }
        remaining -= length;
      }
      return [last, last === next ? next.childNodes.length : (last.textContent?.length ?? 0)];
    };
    next.focus({ preventScroll: true });
    ownerDocument.getSelection()?.setBaseAndExtent(...point(anchor), ...point(focus));
    for (const { element, top, left } of scroll) {
      if (element.isConnected) {
        element.scrollTop = top;
        element.scrollLeft = left;
      }
    }
  };
}
