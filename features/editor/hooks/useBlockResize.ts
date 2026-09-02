'use client';

import {
  type FocusEventHandler,
  type PointerEventHandler,
  type KeyboardEventHandler,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export type ResizeDirection = 'left' | 'right' | null;
export type TextAlignment = 'left' | 'center' | 'right';

interface UseBlockResizeOptions {
  containerRef: RefObject<HTMLElement | null>;
  previewWidth: string;
  onResize: (newWidthPercent: number) => void;
  keyboardSession?: {
    owner: object;
    key: string;
  };
  enabled?: boolean;
  minWidth?: number;
  maxWidth?: number;
  step?: number;
}

interface UseBlockResizeReturn {
  widthPercent: number;
  isDragging: ResizeDirection;
  minWidth: number;
  maxWidth: number;
  startResizeLeft: PointerEventHandler<HTMLButtonElement>;
  startResizeRight: PointerEventHandler<HTMLButtonElement>;
  onResizeKeyDown: KeyboardEventHandler<HTMLButtonElement>;
  onResizeBlur: FocusEventHandler<HTMLButtonElement>;
  getMarginStyle: (textAlignment?: TextAlignment) => string | undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function readEditorWidth(container: HTMLElement | null): number {
  const blockWrapper = container?.closest('[data-node-type="blockContainer"]');
  const editorContent = blockWrapper?.parentElement ?? container?.parentElement;
  return editorContent?.getBoundingClientRect().width ?? 0;
}

interface KeyboardResizeSession {
  handle: HTMLElement;
  initialWidth: number;
  latestWidth: number;
}

const keyboardResizeSessions = new WeakMap<object, Map<string, KeyboardResizeSession>>();

function keyboardResizeScope(handle: HTMLElement | null, owner: object | undefined): object | undefined {
  return handle?.ownerDocument ?? owner;
}

function keyboardResizeKey(handle: HTMLElement | null, explicitKey: string | undefined): string | undefined {
  if (explicitKey) {
    return explicitKey;
  }
  const block = handle?.closest<HTMLElement>('[data-node-type="blockContainer"]');
  const content = handle?.closest<HTMLElement>('[data-content-type]');
  const blockId = block?.dataset.id;
  const contentType = content?.dataset.contentType;
  return blockId && contentType ? `${contentType}:${blockId}` : undefined;
}

function readKeyboardResizeStart(
  scope: object | undefined,
  key: string | undefined,
  handle: HTMLElement,
  currentWidth: number,
): number | null {
  if (!scope || !key) {
    return null;
  }
  const session = keyboardResizeSessions.get(scope)?.get(key);
  if (!session) {
    return null;
  }
  if (session.handle !== handle) {
    if (session.handle.isConnected || session.latestWidth !== currentWidth) {
      return null;
    }
    session.handle = handle;
  }
  return session.initialWidth;
}

function rememberKeyboardResizeStart(
  scope: object | undefined,
  key: string | undefined,
  handle: HTMLElement,
  width: number,
  nextWidth: number,
): void {
  if (!scope || !key) {
    return;
  }
  const sessions = keyboardResizeSessions.get(scope) ?? new Map<string, KeyboardResizeSession>();
  const session = sessions.get(key);
  if (session && (session.handle === handle || (!session.handle.isConnected && session.latestWidth === width))) {
    session.handle = handle;
    session.latestWidth = nextWidth;
  } else {
    sessions.set(key, { handle, initialWidth: width, latestWidth: nextWidth });
  }
  keyboardResizeSessions.set(scope, sessions);
}

function clearKeyboardResizeStart(
  scope: object | undefined,
  key: string | undefined,
  expectedHandle?: HTMLElement,
): void {
  if (!scope || !key) {
    return;
  }
  const sessions = keyboardResizeSessions.get(scope);
  const session = sessions?.get(key);
  if (!session || (expectedHandle ? session.handle !== expectedHandle : session.handle.isConnected)) {
    return;
  }
  sessions?.delete(key);
  if (sessions?.size === 0) {
    keyboardResizeSessions.delete(scope);
  }
}

/** Shared feature adapter for pointer and keyboard media-width authoring. */
export function useBlockResize({
  containerRef,
  previewWidth,
  onResize,
  keyboardSession,
  enabled = true,
  minWidth = 10,
  maxWidth = 100,
  step = 5,
}: UseBlockResizeOptions): UseBlockResizeReturn {
  const keyboardSessionOwner = keyboardSession?.owner;
  const keyboardSessionKey = keyboardSession?.key;
  const persistedWidth = clamp(Number.parseInt(previewWidth, 10) || maxWidth, minWidth, maxWidth);
  const [draftWidth, setDraftWidth] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState<ResizeDirection>(null);
  const sessionRef = useRef<{
    direction: Exclude<ResizeDirection, null>;
    pointerId: number;
    startX: number;
    startWidth: number;
    editorWidth: number;
    latestWidth: number;
  } | null>(null);
  const keyboardStartWidthRef = useRef<number | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const widthPercent = draftWidth ?? persistedWidth;

  useEffect(() => {
    if (!isDragging && draftWidth === persistedWidth) {
      setDraftWidth(null);
    }
  }, [draftWidth, isDragging, persistedWidth]);

  useEffect(() => {
    if (enabled) {
      return;
    }
    sessionRef.current = null;
    keyboardStartWidthRef.current = null;
    const resizeHandle = containerRef.current?.querySelector<HTMLElement>('[data-resize-handle]') ?? null;
    clearKeyboardResizeStart(
      keyboardResizeScope(containerRef.current, keyboardSessionOwner),
      keyboardResizeKey(containerRef.current, keyboardSessionKey),
      resizeHandle ?? undefined,
    );
    setIsDragging(null);
    setDraftWidth(null);
  }, [enabled, keyboardSessionKey, keyboardSessionOwner]);

  const commit = useCallback(
    (width: number) => {
      if (!enabledRef.current) {
        return;
      }
      const nextWidth = clamp(width, minWidth, maxWidth);
      setDraftWidth(nextWidth);
      onResize(nextWidth);
    },
    [maxWidth, minWidth, onResize],
  );

  const finishPointerResize = useCallback(
    (cancelled: boolean) => {
      const session = sessionRef.current;
      if (!session) {
        return;
      }
      sessionRef.current = null;
      setIsDragging(null);
      if (cancelled) {
        setDraftWidth(null);
        return;
      }
      if (enabledRef.current) {
        commit(session.latestWidth);
      } else {
        setDraftWidth(null);
      }
    },
    [commit],
  );

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const session = sessionRef.current;
      if (!enabledRef.current || !session || session.pointerId !== event.pointerId) {
        return;
      }
      const deltaPercent = ((event.clientX - session.startX) / session.editorWidth) * 100;
      const directionalDelta = session.direction === 'right' ? deltaPercent : -deltaPercent;
      const nextWidth = clamp(session.startWidth + directionalDelta, minWidth, maxWidth);
      session.latestWidth = nextWidth;
      setDraftWidth(nextWidth);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (sessionRef.current?.pointerId === event.pointerId) {
        finishPointerResize(false);
      }
    };
    const onPointerCancel = (event: PointerEvent) => {
      if (sessionRef.current?.pointerId === event.pointerId) {
        finishPointerResize(true);
      }
    };
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerCancel);
    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [finishPointerResize, maxWidth, minWidth]);

  const startPointerResize = useCallback(
    (direction: Exclude<ResizeDirection, null>): PointerEventHandler<HTMLButtonElement> =>
      (event) => {
        if (!enabledRef.current) {
          return;
        }
        const editorWidth = readEditorWidth(containerRef.current);
        if (editorWidth <= 0) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        sessionRef.current = {
          direction,
          pointerId: event.pointerId,
          startX: event.clientX,
          startWidth: widthPercent,
          editorWidth,
          latestWidth: widthPercent,
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setDraftWidth(widthPercent);
        setIsDragging(direction);
      },
    [containerRef, widthPercent],
  );

  const handleResizeKeyDown = useCallback(
    (key: string, handle: HTMLButtonElement): boolean => {
      if (!enabledRef.current) {
        return false;
      }
      if (key === 'Escape') {
        const scope = keyboardResizeScope(handle, keyboardSessionOwner);
        const sessionKey = keyboardResizeKey(handle, keyboardSessionKey);
        const initialWidth =
          readKeyboardResizeStart(scope, sessionKey, handle, widthPercent) ?? keyboardStartWidthRef.current;
        keyboardStartWidthRef.current = null;
        clearKeyboardResizeStart(scope, sessionKey, handle);
        if (initialWidth != null) {
          commit(initialWidth);
        }
        return true;
      }
      const nextWidth =
        key === 'ArrowLeft' || key === 'ArrowDown'
          ? widthPercent - step
          : key === 'ArrowRight' || key === 'ArrowUp'
            ? widthPercent + step
            : key === 'Home'
              ? minWidth
              : key === 'End'
                ? maxWidth
                : null;
      if (nextWidth == null) {
        return false;
      }
      keyboardStartWidthRef.current ??= widthPercent;
      rememberKeyboardResizeStart(
        keyboardResizeScope(handle, keyboardSessionOwner),
        keyboardResizeKey(handle, keyboardSessionKey),
        handle,
        widthPercent,
        clamp(nextWidth, minWidth, maxWidth),
      );
      commit(nextWidth);
      return true;
    },
    [commit, keyboardSessionKey, keyboardSessionOwner, maxWidth, minWidth, step, widthPercent],
  );

  const onResizeKeyDown = useCallback<KeyboardEventHandler<HTMLButtonElement>>(
    (event) => {
      if (!handleResizeKeyDown(event.key, event.currentTarget)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    },
    [handleResizeKeyDown],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const ownerDocument = containerRef.current?.ownerDocument;
    const onDocumentKeyDown = (event: KeyboardEvent) => {
      const handle = event.target;
      if (
        !(handle instanceof HTMLButtonElement) ||
        !handle.hasAttribute('data-resize-handle') ||
        !containerRef.current?.contains(handle) ||
        !handleResizeKeyDown(event.key, handle)
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };
    ownerDocument?.addEventListener('keydown', onDocumentKeyDown, true);
    return () => ownerDocument?.removeEventListener('keydown', onDocumentKeyDown, true);
  }, [containerRef, enabled, handleResizeKeyDown]);

  const onResizeBlur = useCallback<FocusEventHandler<HTMLButtonElement>>(
    (event) => {
      const handle = event.currentTarget;
      queueMicrotask(() => {
        if (!handle.isConnected) {
          return;
        }
        keyboardStartWidthRef.current = null;
        clearKeyboardResizeStart(
          keyboardResizeScope(handle, keyboardSessionOwner),
          keyboardResizeKey(handle, keyboardSessionKey),
          handle,
        );
      });
    },
    [keyboardSessionKey, keyboardSessionOwner],
  );

  const getMarginStyle = useCallback(
    (textAlignment: TextAlignment = 'left'): string | undefined => {
      if (widthPercent >= 100) {
        return undefined;
      }
      if (textAlignment === 'center') {
        return '0 auto';
      }
      if (textAlignment === 'right') {
        return '0 0 0 auto';
      }
      return undefined;
    },
    [widthPercent],
  );

  return useMemo(
    () => ({
      widthPercent,
      isDragging,
      minWidth,
      maxWidth,
      startResizeLeft: startPointerResize('left'),
      startResizeRight: startPointerResize('right'),
      onResizeKeyDown,
      onResizeBlur,
      getMarginStyle,
    }),
    [getMarginStyle, isDragging, maxWidth, minWidth, onResizeBlur, onResizeKeyDown, startPointerResize, widthPercent],
  );
}
