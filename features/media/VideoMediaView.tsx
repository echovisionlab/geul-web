import { useCallback, useState, type ReactNode } from 'react';
import { Text } from '@/components/core/Typography';
import type { VideoViewModel } from '@/lib/media/video-view-model';
import { VideoPlayer } from './VideoPlayer';
import { MediaBlockHeader } from './ui/MediaBlockHeader';
import { MediaBlockCaption, MediaBlockMetaText, MediaBlockShell } from './ui/MediaBlockShell';

interface VideoMediaViewProps {
  model: VideoViewModel;
  className?: string;
  style?: React.CSSProperties;
  titleContent?: ReactNode;
  captionContent?: ReactNode;
  headerEnd?: ReactNode;
  headerMetaEnd?: ReactNode;
  playerAction?: ReactNode;
  beforePlayer?: ReactNode;
  afterPlayer?: ReactNode;
  onNaturalSize?: (width: number, height: number) => void;
}

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function VideoMediaView({
  model,
  className,
  style,
  titleContent,
  captionContent,
  headerEnd,
  headerMetaEnd,
  playerAction,
  beforePlayer,
  afterPlayer,
  onNaturalSize,
}: VideoMediaViewProps) {
  const resolvedStyle = style || model.containerStyle;
  const [portrait, setPortrait] = useState(false);
  const reportNaturalSize = useCallback(
    (width: number, height: number) => {
      setPortrait(height > width);
      onNaturalSize?.(width, height);
    },
    [onNaturalSize],
  );

  return (
    <MediaBlockShell
      className={joinClassNames('video-block', className)}
      style={resolvedStyle}
      domAttrs={{ ...model.domAttrs, 'data-media-portrait': portrait ? '' : undefined }}
      header={
        <MediaBlockHeader
          headerClassName="video-block__header"
          metaClassName="video-block__meta"
          title={
            titleContent || (
              <Text as="span" size="sm" weight="strong" truncate>
                {model.title}
              </Text>
            )
          }
          meta={
            model.sizeText ? (
              <MediaBlockMetaText className="video-block__size">{model.sizeText}</MediaBlockMetaText>
            ) : undefined
          }
          metaEnd={headerMetaEnd}
          end={headerEnd}
        />
      }
      caption={captionContent || <MediaBlockCaption>{model.caption}</MediaBlockCaption>}
    >
      {beforePlayer}
      <VideoPlayer
        name={model.title}
        hlsSrc={model.hlsUrl}
        src={model.playbackUrl}
        poster={model.posterUrl}
        isReady={model.isReady}
        duration={model.durationSeconds}
        isProcessing={model.isProcessing}
        action={playerAction}
        onNaturalSize={reportNaturalSize}
      />
      {afterPlayer}
    </MediaBlockShell>
  );
}
