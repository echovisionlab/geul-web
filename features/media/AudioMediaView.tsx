'use client';

import type { ReactNode } from 'react';
import type { AudioViewModel } from '@/lib/media/audio-view-model';
import { AudioPlayer } from './AudioPlayer';
import { MediaBlockHeader } from './ui/MediaBlockHeader';
import { MediaBlockCaption, MediaBlockMetaText, MediaBlockShell } from './ui/MediaBlockShell';

interface AudioMediaViewProps {
  model: AudioViewModel;
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

export function AudioMediaView({
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
}: AudioMediaViewProps) {
  return (
    <MediaBlockShell
      className={joinClassNames('audio-block', className)}
      style={style || model.containerStyle}
      domAttrs={model.domAttrs}
      header={
        <MediaBlockHeader
          headerClassName="audio-block__header"
          metaClassName="audio-block__meta"
          title={titleContent || <span className="audio-block__title">{model.title}</span>}
          meta={
            model.sizeText ? (
              <MediaBlockMetaText className="audio-block__size">{model.sizeText}</MediaBlockMetaText>
            ) : undefined
          }
          metaEnd={headerMetaEnd}
          end={headerEnd}
          headerStyle={{ flexWrap: 'wrap' }}
          metaStyle={{ flex: '1 1 24rem', minWidth: '14ch', overflow: 'visible' }}
        />
      }
      caption={captionContent || <MediaBlockCaption>{model.caption}</MediaBlockCaption>}
    >
      {beforePlayer}

      <AudioPlayer
        src={model.playbackUrl}
        hlsSrc={model.hlsUrl}
        name={model.title}
        isReady={model.isReady}
        duration={model.durationSeconds}
        waveform={model.waveformData}
        waveformUrl={model.waveformUrl}
        action={playerAction}
        actions={model.actions}
      />

      {afterPlayer}
    </MediaBlockShell>
  );
}
