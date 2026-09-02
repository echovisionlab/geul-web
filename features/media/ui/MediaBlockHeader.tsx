'use client';

import type { ReactNode } from 'react';

interface MediaBlockHeaderProps {
  headerClassName: string;
  metaClassName: string;
  title: ReactNode;
  meta?: ReactNode;
  metaEnd?: ReactNode;
  end?: ReactNode;
  titleSlotClassName?: string;
  headerStyle?: React.CSSProperties;
  metaStyle?: React.CSSProperties;
}

export function MediaBlockHeader({
  headerClassName,
  metaClassName,
  title,
  meta,
  metaEnd,
  end,
  titleSlotClassName,
  headerStyle,
  metaStyle,
}: MediaBlockHeaderProps) {
  return (
    <div className={headerClassName} style={headerStyle}>
      <div className={metaClassName} style={metaStyle}>
        {titleSlotClassName ? <div className={titleSlotClassName}>{title}</div> : title}
        {meta !== undefined || metaEnd !== undefined ? (
          <div
            data-media-block-meta-row
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 12,
              width: '100%',
              minWidth: 0,
            }}
          >
            <div style={{ minWidth: 0 }}>{meta}</div>
            {metaEnd !== undefined ? <div style={{ flex: '0 0 auto' }}>{metaEnd}</div> : null}
          </div>
        ) : null}
      </div>
      {end}
    </div>
  );
}
