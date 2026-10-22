'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { ContentBlockMediaItem } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { EditorSnapshotMediaProvider } from './contexts/EditorSnapshotMediaContext';

const EMPTY_MEDIA: readonly ContentBlockMediaItem[] = [];

/**
 * Keeps SSR pixels in place until the room-backed view has mounted, including lazy chunks.
 * `media` hands the snapshot's File deliveries to the live editor, so its File blocks open as rendered.
 */
export function EditorSnapshotHandoff({
  snapshot,
  media = EMPTY_MEDIA,
  ready,
  editable,
  children,
  page = false,
}: {
  snapshot: ReactNode;
  media?: readonly ContentBlockMediaItem[];
  ready: boolean;
  editable: boolean;
  children: ReactNode;
  page?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const live = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const pendingClick = useRef<{ blockId?: string; x: number; y: number } | null>(null);
  const scroll = useRef<{ element: Element; top: number; left: number }[]>([]);
  const showLive = ready && mounted;

  useLayoutEffect(() => {
    if (!ready || !live.current) {
      setMounted(false);
      return;
    }
    let adopted = false;
    const check = () => {
      if (adopted) {
        return;
      }
      const surface = live.current;
      if (!surface || !surface.querySelector(page ? '[data-page-body-mounted], .ProseMirror' : '.ProseMirror')) {
        return;
      }
      if (
        page &&
        Array.from(
          surface.querySelectorAll(
            '[data-page-section-editor-preview][data-section-type="rich-text"], [data-room-rich-text]',
          ),
        ).some((host) => !host.querySelector('.ProseMirror'))
      ) {
        return;
      }
      adopted = true;
      scroll.current = [];
      for (let element: Element | null = root.current; element; element = element.parentElement) {
        scroll.current.push({ element, top: element.scrollTop, left: element.scrollLeft });
      }
      if (document.scrollingElement) {
        const element = document.scrollingElement;
        scroll.current.push({ element, top: element.scrollTop, left: element.scrollLeft });
      }
      setMounted(true);
    };
    const observer = new MutationObserver(check);
    observer.observe(live.current, { childList: true, subtree: true });
    check();
    return () => observer.disconnect();
  }, [ready, page]);

  useLayoutEffect(() => {
    if (!showLive) {
      return;
    }
    for (const { element, top, left } of scroll.current) {
      element.scrollTop = top;
      element.scrollLeft = left;
    }
  }, [showLive]);

  useEffect(() => {
    if (!showLive || !editable || !pendingClick.current || !live.current) {
      return;
    }
    const focusClick = () => {
      const click = pendingClick.current;
      if (!click) {
        return;
      }
      const block = click.blockId
        ? Array.from(live.current?.querySelectorAll<HTMLElement>('[data-id]') ?? []).find(
            (element) => element.dataset.id === click.blockId,
          )
        : null;
      const editor =
        block?.closest<HTMLElement>('[contenteditable="true"]') ??
        live.current?.querySelector<HTMLElement>('[contenteditable="true"]');
      if (!editor) {
        return;
      }
      pendingClick.current = null;
      editor.focus({ preventScroll: true });
      const caret = document.caretPositionFromPoint?.(click.x, click.y);
      if (caret && editor.contains(caret.offsetNode)) {
        window.getSelection()?.setPosition(caret.offsetNode, caret.offset);
      }
    };
    const observer = new MutationObserver(focusClick);
    observer.observe(live.current, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['contenteditable'],
    });
    focusClick();
    return () => observer.disconnect();
  }, [showLive, editable]);

  return (
    <div ref={root} style={{ position: 'relative' }} data-editor-snapshot-handoff>
      {!showLive ? (
        <div
          onPointerDownCapture={(event) => {
            if (event.button !== 0 || (event.target as Element).closest('a, button, input, select, textarea')) {
              return;
            }
            pendingClick.current = {
              blockId: (event.target as Element).closest<HTMLElement>('[data-id]')?.dataset.id,
              x: event.clientX,
              y: event.clientY,
            };
          }}
        >
          {snapshot}
        </div>
      ) : null}
      {ready ? (
        <div
          ref={live}
          aria-hidden={!showLive || undefined}
          inert={!showLive || undefined}
          style={showLive ? undefined : { position: 'absolute', inset: 0, visibility: 'hidden', pointerEvents: 'none' }}
        >
          <EditorSnapshotMediaProvider items={media}>{children}</EditorSnapshotMediaProvider>
        </div>
      ) : null}
    </div>
  );
}
