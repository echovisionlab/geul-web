import { MediaBlockCaption, MediaBlockShell } from './MediaBlockShell';

import type { ReactNode } from 'react';

interface ImageMediaViewProps {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
  style?: React.CSSProperties;
  onError?: React.ReactEventHandler<HTMLImageElement>;
  action?: ReactNode;
}

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function ImageMediaView({ src, alt, caption, className, style, onError, action }: ImageMediaViewProps) {
  return (
    <MediaBlockShell
      as="figure"
      className={joinClassNames('image-block', className)}
      style={style}
      header={action ? <div className="image-block__action">{action}</div> : undefined}
      caption={<MediaBlockCaption>{caption}</MediaBlockCaption>}
    >
      <img src={src} alt={alt} style={{ maxWidth: '100%' }} onError={onError} />
    </MediaBlockShell>
  );
}
