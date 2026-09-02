'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react';
import type { Editor } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { isMonacoSourceEditorTarget } from '../code-editor';

const ACTION_SELECTOR = '[data-selection-toolbar-action]';

/**
 * The only shared BubbleMenu lifecycle adapter: give Tiptap a stable key and
 * send its documented `hide` meta after focus returns to the editor.
 */
export function useTiptapBubbleMenu(editor: Editor, pluginName: string | PluginKey) {
  const pluginKeyRef = useRef<PluginKey | null>(null);
  const dismissedRef = useRef(false);
  const [isDismissed, setIsDismissed] = useState(false);
  if (typeof pluginName === 'string' && !pluginKeyRef.current) {
    pluginKeyRef.current = new PluginKey(pluginName);
  }
  const pluginKey = typeof pluginName === 'string' ? pluginKeyRef.current! : pluginName;
  useEffect(() => {
    const reopen = () => {
      if (!dismissedRef.current) {
        return;
      }
      dismissedRef.current = false;
      setIsDismissed(false);
    };
    editor.on('selectionUpdate', reopen);
    return () => {
      editor.off('selectionUpdate', reopen);
    };
  }, [editor]);
  const hide = useCallback(() => {
    dismissedRef.current = true;
    setIsDismissed(true);
    editor.view.focus();
    const schedule = editor.view.dom.ownerDocument.defaultView?.setTimeout ?? setTimeout;
    schedule(() => {
      if (!editor.isDestroyed && dismissedRef.current) {
        editor.view.dispatch(editor.state.tr.setMeta(pluginKey, 'hide').setMeta('addToHistory', false));
      }
    }, 0);
  }, [editor, pluginKey]);
  return { pluginKey, hide, isDismissed };
}

function isNativeArrowTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'));
}

function isNativeTabTarget(target: EventTarget | null, editorElement: HTMLElement): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  // Monaco uses an EditContext-backed div rather than a native textarea in
  // current browsers. Treat the whole source surface as a nested editor so
  // its first Escape exits to NodeSelection instead of also dismissing the
  // selection toolbar in the editor-root capture listener.
  if (isMonacoSourceEditorTarget(target)) {
    return true;
  }
  if (target.closest('input, textarea, select')) {
    return true;
  }
  const editable = target.closest<HTMLElement>('[contenteditable]:not([contenteditable="false"])');
  return editable !== null && editable !== editorElement;
}

function isVisibleEnabledAction(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  if (element.matches(':disabled, [aria-disabled="true"]')) {
    return false;
  }
  if (element.hidden || element.closest('[hidden], [aria-hidden="true"]')) {
    return false;
  }
  const toolbar = element.closest<HTMLElement>('[role="toolbar"]');
  for (let current: HTMLElement | null = element; current && current !== toolbar; current = current.parentElement) {
    const style = getComputedStyle(current);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }
  }
  return true;
}

export interface SelectionToolbarNavigation {
  toolbarRef: RefObject<HTMLDivElement | null>;
  onToolbarKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onToolbarFocusCapture: (event: FocusEvent<HTMLDivElement>) => void;
  focusFirstAction: () => boolean;
  focusLastAction: () => boolean;
}

export function useSelectionToolbarNavigation({
  onEscape,
  enableVerticalArrows = false,
}: {
  onEscape?: () => void;
  enableVerticalArrows?: boolean;
} = {}): SelectionToolbarNavigation {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(0);

  const getAllActions = useCallback(
    () => Array.from(toolbarRef.current?.querySelectorAll<HTMLElement>(ACTION_SELECTOR) ?? []),
    [],
  );

  const getActions = useCallback(() => getAllActions().filter(isVisibleEnabledAction), [getAllActions]);

  const setActiveAction = useCallback(
    (actions: readonly HTMLElement[], requestedIndex: number) => {
      getAllActions().forEach((action) => {
        action.tabIndex = -1;
      });
      if (actions.length === 0) {
        return false;
      }
      const index = Math.max(0, Math.min(requestedIndex, actions.length - 1));
      const action = actions[index]!;
      if (!action.isConnected || !isVisibleEnabledAction(action)) {
        return false;
      }
      action.tabIndex = 0;
      action.focus();
      if (document.activeElement === action) {
        activeIndexRef.current = index;
        return true;
      }
      action.tabIndex = -1;
      return false;
    },
    [getAllActions],
  );

  const focusFirstAction = useCallback(() => setActiveAction(getActions(), 0), [getActions, setActiveAction]);
  const focusLastAction = useCallback(() => {
    const actions = getActions();
    return setActiveAction(actions, actions.length - 1);
  }, [getActions, setActiveAction]);

  useLayoutEffect(() => {
    const synchronize = () => {
      const allActions = getAllActions();
      const actions = getActions();
      allActions.forEach((action) => {
        action.tabIndex = -1;
      });
      if (actions.length === 0) {
        return;
      }
      const focusedIndex = actions.findIndex((action) => action === document.activeElement);
      const index = focusedIndex >= 0 ? focusedIndex : Math.min(activeIndexRef.current, actions.length - 1);
      activeIndexRef.current = index;
      actions[index]!.tabIndex = 0;
    };
    synchronize();
    const schedule = toolbarRef.current?.ownerDocument.defaultView?.setTimeout ?? setTimeout;
    const cancel = toolbarRef.current?.ownerDocument.defaultView?.clearTimeout ?? clearTimeout;
    const timeout = schedule(synchronize, 0);
    return () => cancel(timeout);
  });

  const onToolbarFocusCapture = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      const action = event.target instanceof HTMLElement ? event.target.closest(ACTION_SELECTOR) : null;
      if (!action) {
        return;
      }
      const actions = getActions();
      const index = actions.indexOf(action as HTMLElement);
      if (index >= 0) {
        activeIndexRef.current = index;
        getAllActions().forEach((item) => {
          item.tabIndex = -1;
        });
        actions[index]!.tabIndex = 0;
      }
    },
    [getActions, getAllActions],
  );

  const onToolbarKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape' && onEscape) {
        event.preventDefault();
        event.stopPropagation();
        onEscape();
        return;
      }
      if (isNativeArrowTarget(event.target)) {
        return;
      }

      const action = event.target instanceof HTMLElement ? event.target.closest(ACTION_SELECTOR) : null;
      if (!action) {
        return;
      }
      const actions = getActions();
      const currentIndex = actions.indexOf(action as HTMLElement);
      if (currentIndex < 0) {
        return;
      }

      let nextIndex: number | null = null;
      if (event.key === 'Tab') {
        nextIndex = event.shiftKey
          ? (currentIndex - 1 + actions.length) % actions.length
          : (currentIndex + 1) % actions.length;
      } else if (event.key === 'ArrowRight' || (enableVerticalArrows && event.key === 'ArrowDown')) {
        nextIndex = (currentIndex + 1) % actions.length;
      } else if (event.key === 'ArrowLeft' || (enableVerticalArrows && event.key === 'ArrowUp')) {
        nextIndex = (currentIndex - 1 + actions.length) % actions.length;
      } else if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = actions.length - 1;
      }
      if (nextIndex === null) {
        return;
      }

      if (setActiveAction(actions, nextIndex)) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    [enableVerticalArrows, getActions, onEscape, setActiveAction],
  );

  return {
    toolbarRef,
    onToolbarKeyDown,
    onToolbarFocusCapture,
    focusFirstAction,
    focusLastAction,
  };
}

export function useSelectionToolbarEditorTabBridge(
  editorElement: HTMLElement | null,
  focusFirstAction: () => boolean,
  enabled = true,
  onEscape?: () => boolean | void,
) {
  useEffect(() => {
    if (!editorElement || !enabled) {
      return;
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        !event.defaultPrevented &&
        !event.isComposing &&
        !isNativeTabTarget(event.target, editorElement) &&
        onEscape
      ) {
        const result = onEscape();
        if (result !== false) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        }
        return;
      }
      if (
        event.defaultPrevented ||
        event.key !== 'Tab' ||
        event.shiftKey ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isNativeTabTarget(event.target, editorElement)
      ) {
        return;
      }
      if (focusFirstAction()) {
        event.preventDefault();
      }
    };
    editorElement.addEventListener('keydown', onKeyDown, true);
    return () => editorElement.removeEventListener('keydown', onKeyDown, true);
  }, [editorElement, enabled, focusFirstAction, onEscape]);
}
