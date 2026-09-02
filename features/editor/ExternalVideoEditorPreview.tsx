'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalVideoView, type ExternalVideoViewProps } from '@/features/media/ExternalVideoView';
import type { StandaloneExternalVideoLink } from '@/features/media/standalone-external-video';
import { EditorMediaBlockFrame } from './ui/EditorMediaBlockShell';
import classes from './ui/ExternalVideoEditorPreview.module.css';

export interface ExternalVideoEditorPreviewLabels {
  editLink: string;
  showPreview: string;
  aspectRatio: string;
  automaticAspectRatio: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
}

interface ExternalVideoEditorPreviewProps {
  mode: 'preview' | 'link';
  video: StandaloneExternalVideoLink;
  labels: ExternalVideoEditorPreviewLabels;
  editable: boolean;
  selected: boolean;
  canSelect?: () => boolean;
  onSelect: () => void;
  onShowPreview: () => void;
  onPreviewWidthChange: (previewWidth: string) => void;
  videoView?: React.ComponentType<ExternalVideoViewProps>;
}

export function ExternalVideoEditorPreview({
  mode,
  video,
  labels,
  editable,
  selected,
  canSelect = () => editable,
  onSelect,
  onShowPreview,
  onPreviewWidthChange,
  videoView: VideoView = ExternalVideoView,
}: ExternalVideoEditorPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeSessionRef = useRef<{
    direction: 'left' | 'right';
    pointerId: number;
    handle: HTMLElement;
    initialClientX: number;
    initialWidth: number;
    editorWidth: number;
    latestWidth: number;
  } | null>(null);
  const editableRef = useRef(editable);
  editableRef.current = editable;
  const persistedWidth = useMemo(
    () => Math.max(10, Math.min(100, Number.parseInt(video.previewWidth, 10) || 100)),
    [video.previewWidth],
  );
  const [draftWidth, setDraftWidth] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const widthPercent = draftWidth ?? persistedWidth;

  const cancelResize = useCallback(() => {
    const session = resizeSessionRef.current;
    if (session) {
      try {
        session.handle.releasePointerCapture?.(session.pointerId);
      } catch {
        // The browser may already have released capture after cancellation.
      }
    }
    resizeSessionRef.current = null;
    setIsResizing(false);
    setDraftWidth(null);
  }, []);

  useEffect(() => {
    if (!editable) {
      cancelResize();
    }
  }, [cancelResize, editable]);

  useEffect(() => {
    if (!isResizing && draftWidth === persistedWidth) {
      setDraftWidth(null);
    }
  }, [draftWidth, isResizing, persistedWidth]);

  const startResize = useCallback(
    (direction: 'left' | 'right') => (event: React.PointerEvent<HTMLElement>) => {
      if (!editableRef.current || !canSelect()) {
        return;
      }
      const blockWrapper = containerRef.current?.closest('[data-node-type="blockContainer"]');
      const editorContent = blockWrapper?.parentElement;
      if (!containerRef.current || !editorContent) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const editorWidth = editorContent.getBoundingClientRect().width;
      if (editorWidth <= 0) {
        return;
      }

      const initialWidth = (containerRef.current.getBoundingClientRect().width / editorWidth) * 100;
      resizeSessionRef.current = {
        direction,
        pointerId: event.pointerId,
        handle: event.currentTarget,
        initialClientX: event.clientX,
        initialWidth,
        editorWidth,
        latestWidth: initialWidth,
      };
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch {
        // Synthetic Storybook pointer events do not register an active pointer.
      }
      setDraftWidth(initialWidth);
      setIsResizing(true);
    },
    [canSelect],
  );

  const handleResizeMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const session = resizeSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) {
        return;
      }
      if (!editableRef.current || !canSelect()) {
        cancelResize();
        return;
      }
      event.preventDefault();
      const deltaPercent = ((event.clientX - session.initialClientX) / session.editorWidth) * 100;
      const alignmentMultiplier = video.textAlignment === 'center' ? 2 : 1;
      const directionalDelta = session.direction === 'right' ? deltaPercent : -deltaPercent;
      const nextWidth = Math.max(
        10,
        Math.min(100, Math.round(session.initialWidth + directionalDelta * alignmentMultiplier)),
      );
      session.latestWidth = nextWidth;
      setDraftWidth(nextWidth);
    },
    [canSelect, cancelResize, video.textAlignment],
  );

  const handleResizeEnd = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const session = resizeSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) {
        return;
      }
      event.preventDefault();
      if (!editableRef.current || !canSelect()) {
        cancelResize();
        return;
      }
      try {
        session.handle.releasePointerCapture?.(event.pointerId);
      } catch {
        // The browser may already have released capture after cancellation.
      }
      resizeSessionRef.current = null;
      setIsResizing(false);
      setDraftWidth(session.latestWidth);
      onPreviewWidthChange(String(session.latestWidth));
    },
    [canSelect, cancelResize, onPreviewWidthChange],
  );

  const handleResizeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (!editableRef.current || !canSelect()) {
        return;
      }
      const delta =
        event.key === 'ArrowLeft' || event.key === 'ArrowDown'
          ? -5
          : event.key === 'ArrowRight' || event.key === 'ArrowUp'
            ? 5
            : 0;
      if (!delta) {
        return;
      }
      event.preventDefault();
      const nextWidth = Math.max(10, Math.min(100, widthPercent + delta));
      setDraftWidth(nextWidth);
      onPreviewWidthChange(String(nextWidth));
    },
    [canSelect, onPreviewWidthChange, widthPercent],
  );

  const margin = useMemo(() => {
    if (widthPercent >= 100) {
      return undefined;
    }
    if (video.textAlignment === 'center') {
      return '0 auto';
    }
    if (video.textAlignment === 'right') {
      return '0 0 0 auto';
    }
    return undefined;
  }, [video.textAlignment, widthPercent]);
  if (mode === 'link') {
    return editable ? (
      <div className={classes.linkMode} data-external-video-link-mode>
        <button type="button" className={classes.action} onClick={onShowPreview}>
          {labels.showPreview}
        </button>
      </div>
    ) : null;
  }

  return (
    <div
      className={classes.root}
      data-external-video-editor-preview
      data-external-video-selected={selected || undefined}
    >
      <EditorMediaBlockFrame
        containerRef={containerRef}
        widthPercent={widthPercent}
        margin={margin}
        allowResize={editable && selected}
        isResizing={isResizing}
        selected={selected}
        onResizeLeftPointerDown={startResize('left')}
        onResizeRightPointerDown={startResize('right')}
        onResizePointerMove={handleResizeMove}
        onResizePointerEnd={handleResizeEnd}
        onResizeLeftKeyDown={handleResizeKeyDown}
        onResizeRightKeyDown={handleResizeKeyDown}
      >
        <VideoView url={video.url} title={video.title} aspectRatio={video.aspectRatio} className={classes.player} />
        {editable && !selected ? (
          <button
            type="button"
            className={classes.selectionShield}
            aria-label={video.title}
            onMouseDown={(event) => {
              if (!canSelect()) {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={(event) => {
              if (!canSelect()) {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              if (event.detail !== 0) {
                onSelect();
              }
            }}
            onKeyDown={(event) => {
              if (canSelect() && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                event.stopPropagation();
                onSelect();
              }
            }}
          />
        ) : null}
      </EditorMediaBlockFrame>
    </div>
  );
}
