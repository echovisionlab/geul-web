import type { ReactNode } from 'react';
import { IconFileOff, IconPhotoOff, IconVideoOff, IconVolumeOff } from '@tabler/icons-react';
import { Alert } from '@/components/core/Alert';
import { MediaBlockCaption, MediaBlockShell } from './MediaBlockShell';

export type MissingMediaKind = 'file' | 'image' | 'video' | 'audio';

interface MissingMediaViewProps {
  kind: MissingMediaKind;
  message: string;
  caption?: ReactNode;
  style?: React.CSSProperties;
}

function MissingMediaIcon({ kind }: { kind: MissingMediaKind }) {
  const props = { size: 18, 'aria-hidden': true } as const;

  switch (kind) {
    case 'image':
      return <IconPhotoOff {...props} />;
    case 'video':
      return <IconVideoOff {...props} />;
    case 'audio':
      return <IconVolumeOff {...props} />;
    case 'file':
      return <IconFileOff {...props} />;
  }
}

export function MissingMediaView({ kind, message, caption, style }: MissingMediaViewProps) {
  return (
    <MediaBlockShell
      className={`media-missing-block media-missing-block--${kind}`}
      style={style}
      caption={<MediaBlockCaption>{caption}</MediaBlockCaption>}
    >
      <Alert
        tone="neutral"
        icon={<MissingMediaIcon kind={kind} />}
        title={message}
        role="note"
        data-media-missing-kind={kind}
      />
    </MediaBlockShell>
  );
}
