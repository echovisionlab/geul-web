'use client';

import { useRef } from 'react';
import { BlockSelectionTarget } from '@/components/core/SelectionSurface';
import { TextButton } from '@/components/core/TextButton';
import {
  ExternalVideoView,
  type ExternalVideoPlaybackLabelFormatter,
  type ExternalVideoViewProps,
} from '@/features/media/ExternalVideoView';
import {
  standaloneExternalVideoAspectRatio,
  type StandaloneExternalVideoLink,
} from '@/features/media/standalone-external-video';
import { useBlockResize } from './hooks/useBlockResize';
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
  onDisplaySizeChange: (displaySize: string) => void;
  videoView?: React.ComponentType<ExternalVideoViewProps>;
  thumbnailUrl?: string | null;
  playbackLabels?: ExternalVideoPlaybackLabelFormatter;
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
  onDisplaySizeChange,
  videoView: VideoView = ExternalVideoView,
  thumbnailUrl,
  playbackLabels,
}: ExternalVideoEditorPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const aspectRatio = standaloneExternalVideoAspectRatio(video);
  const resize = useBlockResize({
    containerRef,
    displaySize: video.displaySize,
    aspectRatio,
    textAlignment: video.textAlignment,
    enabled: editable && selected,
    onResize: (displaySize) => onDisplaySizeChange(String(displaySize)),
  });
  // Only an editor that may select this block may start resizing it.
  const startResize =
    (start: React.PointerEventHandler<HTMLButtonElement>): React.PointerEventHandler<HTMLButtonElement> =>
    (event) => {
      if (canSelect()) {
        start(event);
      }
    };
  if (mode === 'link') {
    return editable ? (
      <div className={classes.linkMode} data-external-video-link-mode>
        <TextButton size="xs" onClick={onShowPreview}>
          {labels.showPreview}
        </TextButton>
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
        displaySize={resize.widthPercent}
        aspectRatio={aspectRatio}
        margin={resize.getMarginStyle(video.textAlignment)}
        allowResize={editable && selected}
        isResizing={resize.isDragging !== null}
        selected={selected}
        onResizeLeftPointerDown={startResize(resize.startResizeLeft)}
        onResizeRightPointerDown={startResize(resize.startResizeRight)}
        onResizeTopPointerDown={startResize(resize.startResizeTop)}
        onResizeBottomPointerDown={startResize(resize.startResizeBottom)}
        onResizeLeftKeyDown={resize.onResizeKeyDown}
        onResizeRightKeyDown={resize.onResizeKeyDown}
        onResizeBlur={resize.onResizeBlur}
      >
        <VideoView
          url={video.url}
          title={video.title}
          aspectRatio={video.aspectRatio}
          thumbnailUrl={thumbnailUrl}
          playbackLabels={playbackLabels}
          className={classes.player}
        />
        {editable && !selected ? (
          <BlockSelectionTarget
            pointer="capture"
            label={video.title}
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
