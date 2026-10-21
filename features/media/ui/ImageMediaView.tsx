import { MediaBlockCaption, MediaBlockShell } from './MediaBlockShell';

import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

interface ImageMediaViewProps {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
  style?: React.CSSProperties;
  onError?: React.ReactEventHandler<HTMLImageElement>;
  /** Reports the loaded image's natural size, which sized blocks use for their height cap. */
  onNaturalSize?: (width: number, height: number) => void;
  action?: ReactNode;
}

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function ImageMediaView({
  src,
  alt,
  caption,
  className,
  style,
  onError,
  onNaturalSize,
  action,
}: ImageMediaViewProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [portrait, setPortrait] = useState(false);
  const reportNaturalSize = useCallback(
    (width: number, height: number) => {
      setPortrait(height > width);
      onNaturalSize?.(width, height);
    },
    [onNaturalSize],
  );
  // An image that finished loading before hydration fires no load event for React.
  useLayoutEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) {
      reportNaturalSize(image.naturalWidth, image.naturalHeight);
    }
  }, [src, reportNaturalSize]);
  return (
    <MediaBlockShell
      as="figure"
      className={joinClassNames('image-block', className)}
      style={style}
      domAttrs={{ 'data-media-portrait': portrait ? '' : undefined }}
      header={action ? <div className="image-block__action">{action}</div> : undefined}
      caption={<MediaBlockCaption>{caption}</MediaBlockCaption>}
    >
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        style={{ maxWidth: '100%' }}
        onError={onError}
        onLoad={(event) => reportNaturalSize(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)}
      />
    </MediaBlockShell>
  );
}
