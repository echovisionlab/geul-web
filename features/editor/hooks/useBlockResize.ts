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
import { snapDisplaySize } from '@/components/core/ResizeHandle/display-size';

export type ResizeDirection = 'left' | 'right' | 'top' | 'bottom' | null;
export type TextAlignment = 'left' | 'center' | 'right';

interface UseBlockResizeOptions {
  containerRef: RefObject<HTMLElement | null>;
  displaySize: string;
  onResize: (newWidthPercent: number) => void;
  keyboardSession?: {
    owner: object;
    key: string;
  };
  enabled?: boolean;
  /**
   * Width / height of a block whose height follows its width. Its top and
   * bottom handles then resize it too, and its height is capped at 80svh.
   */
  aspectRatio?: number;
  /** A centered block grows on both sides, so a side handle moves half as far as the width grows. */
  textAlignment?: TextAlignment;
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
  startResizeTop: PointerEventHandler<HTMLButtonElement>;
  startResizeBottom: PointerEventHandler<HTMLButtonElement>;
  onResizeKeyDown: KeyboardEventHandler<HTMLButtonElement>;
  onResizeBlur: FocusEventHandler<HTMLButtonElement>;
  getMarginStyle: (textAlignment?: TextAlignment) => string | undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

/** Keyboard steps settle for this long before the size is saved. */
const KEYBOARD_COMMIT_DELAY_MS = 300;

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
  displaySize,
  onResize,
  keyboardSession,
  enabled = true,
  aspectRatio,
  textAlignment,
  minWidth = 10,
  maxWidth = 100,
  step = 5,
}: UseBlockResizeOptions): UseBlockResizeReturn {
  const keyboardSessionOwner = keyboardSession?.owner;
  const keyboardSessionKey = keyboardSession?.key;
  const persistedWidth = clamp(Number.parseInt(displaySize, 10) || maxWidth, minWidth, maxWidth);
  const [draftWidth, setDraftWidth] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState<ResizeDirection>(null);
  const sessionRef = useRef<{
    direction: Exclude<ResizeDirection, null>;
    pointerId: number;
    startX: number;
    startY: number;
    startWidth: number;
    /** Rendered width at the start of the drag. */
    startPixels: number;
    /** Rendered width at size 100: size/100 × min(column, 80svh × ratio) is linear in size. */
    fullPixels: number;
    aspectRatio: number | undefined;
    centered: boolean;
    latestWidth: number;
  } | null>(null);
  const keyboardCommitRef = useRef<{ timer: ReturnType<typeof setTimeout>; width: number } | null>(null);
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

  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;
  const flushKeyboardCommit = useCallback(() => {
    const pending = keyboardCommitRef.current;
    if (!pending) {
      return;
    }
    clearTimeout(pending.timer);
    keyboardCommitRef.current = null;
    if (enabledRef.current) {
      onResizeRef.current(pending.width);
    }
  }, []);
  useEffect(() => flushKeyboardCommit, [flushKeyboardCommit]);

  const commit = useCallback(
    (width: number, { settle = false }: { settle?: boolean } = {}) => {
      if (!enabledRef.current) {
        return;
      }
      const nextWidth = clamp(width, minWidth, maxWidth);
      setDraftWidth(nextWidth);
      if (!settle) {
        flushKeyboardCommit();
        onResizeRef.current(nextWidth);
        return;
      }
      // The draft shows each step at once; only the settled size is saved.
      if (keyboardCommitRef.current) {
        clearTimeout(keyboardCommitRef.current.timer);
      }
      keyboardCommitRef.current = {
        width: nextWidth,
        timer: setTimeout(flushKeyboardCommit, KEYBOARD_COMMIT_DELAY_MS),
      };
    },
    [flushKeyboardCommit, maxWidth, minWidth],
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
      const dx = event.clientX - session.startX;
      const dy = event.clientY - session.startY;
      // A vertical drag changes the height; the ratio turns it into the same width change.
      const pixelDelta =
        session.direction === 'right' || session.direction === 'left'
          ? (session.direction === 'right' ? dx : -dx) * (session.centered ? 2 : 1)
          : (session.direction === 'bottom' ? dy : -dy) * (session.aspectRatio ?? 1);
      const nextWidth = clamp(
        snapDisplaySize(((session.startPixels + pixelDelta) / session.fullPixels) * 100),
        minWidth,
        maxWidth,
      );
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
        const verticalRatio = direction === 'top' || direction === 'bottom' ? aspectRatio : undefined;
        if ((direction === 'top' || direction === 'bottom') && !verticalRatio) {
          return;
        }
        const startPixels = containerRef.current?.getBoundingClientRect().width ?? 0;
        const fullPixels = startPixels > 0 ? (startPixels * 100) / widthPercent : readEditorWidth(containerRef.current);
        if (fullPixels <= 0) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        flushKeyboardCommit();
        sessionRef.current = {
          direction,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startWidth: widthPercent,
          startPixels: startPixels > 0 ? startPixels : (fullPixels * widthPercent) / 100,
          fullPixels,
          aspectRatio: verticalRatio,
          centered: textAlignment === 'center',
          latestWidth: widthPercent,
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setDraftWidth(widthPercent);
        setIsDragging(direction);
      },
    [aspectRatio, containerRef, flushKeyboardCommit, textAlignment, widthPercent],
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
          commit(initialWidth, { settle: true });
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
      commit(nextWidth, { settle: true });
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
      flushKeyboardCommit();
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
    [flushKeyboardCommit, keyboardSessionKey, keyboardSessionOwner],
  );

  const getMarginStyle = useCallback(
    (textAlignment: TextAlignment = 'left'): string | undefined => {
      // A block with an aspect ratio can be narrower than its column even at full size.
      if (widthPercent >= 100 && !aspectRatio) {
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
    [aspectRatio, widthPercent],
  );

  return useMemo(
    () => ({
      widthPercent,
      isDragging,
      minWidth,
      maxWidth,
      startResizeLeft: startPointerResize('left'),
      startResizeRight: startPointerResize('right'),
      startResizeTop: startPointerResize('top'),
      startResizeBottom: startPointerResize('bottom'),
      onResizeKeyDown,
      onResizeBlur,
      getMarginStyle,
    }),
    [getMarginStyle, isDragging, maxWidth, minWidth, onResizeBlur, onResizeKeyDown, startPointerResize, widthPercent],
  );
}
