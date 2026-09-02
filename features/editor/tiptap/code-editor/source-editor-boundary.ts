export const MONACO_SOURCE_EDITOR_SELECTOR = '[data-source-editor="monaco"]';

export function isMonacoSourceEditorTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(MONACO_SOURCE_EDITOR_SELECTOR) !== null;
}

/** Keeps Monaco editing events inside the nested source editor. */
export function isMonacoSourceEditorEvent(event: Event): boolean {
  return isMonacoSourceEditorTarget(event.target);
}
