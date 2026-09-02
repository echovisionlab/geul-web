import type { ReactNode } from 'react';
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
}: VideoMediaViewProps) {
  const resolvedStyle = style || model.containerStyle;

  return (
    <MediaBlockShell
      className={joinClassNames('video-block', className)}
      style={resolvedStyle}
      domAttrs={model.domAttrs}
      header={
        <MediaBlockHeader
          headerClassName="video-block__header"
          metaClassName="video-block__meta"
          title={titleContent || <span className="video-block__title">{model.title}</span>}
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
        hlsSrc={model.hlsUrl}
        src={model.playbackUrl}
        poster={model.posterUrl}
        isReady={model.isReady}
        duration={model.durationSeconds}
        isProcessing={model.isProcessing}
        action={playerAction}
      />
      {afterPlayer}
    </MediaBlockShell>
  );
}
