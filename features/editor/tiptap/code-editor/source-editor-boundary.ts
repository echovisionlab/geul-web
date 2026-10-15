import type { NodeViewRenderer } from '@tiptap/core';

export const MONACO_SOURCE_EDITOR_SELECTOR = '[data-source-editor="monaco"]';

export function isMonacoSourceEditorTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(MONACO_SOURCE_EDITOR_SELECTOR) !== null;
}

/** Keeps Monaco editing events inside the nested source editor. */
export function isMonacoSourceEditorEvent(event: Event): boolean {
  return isMonacoSourceEditorTarget(event.target);
}
/** Add nested-editor isolation without replacing Tiptap's native control boundary. */
export function withMonacoSourceEditorEvents(
  render: NodeViewRenderer,
  additionalBoundary?: (event: Event) => boolean,
): NodeViewRenderer {
  return (props) => {
    const view = render(props);
    const stopEvent = view.stopEvent?.bind(view);
    view.stopEvent = (event) =>
      isMonacoSourceEditorEvent(event) || additionalBoundary?.(event) === true || (stopEvent?.(event) ?? false);
    return view;
  };
}
