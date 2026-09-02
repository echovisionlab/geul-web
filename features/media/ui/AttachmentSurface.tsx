'use client';

import type { ReactNode } from 'react';
import { MediaBlockHeader } from './MediaBlockHeader';
import { MediaBlockMetaText } from './MediaBlockShell';
import './AttachmentSurface.css';

interface AttachmentSurfaceProps {
  title: ReactNode;
  meta: string;
  metaEnd?: ReactNode;
  action?: ReactNode;
  belowHeader?: ReactNode;
}

export function AttachmentSurface({ title, meta, metaEnd, action, belowHeader }: AttachmentSurfaceProps) {
  return (
    <div className="attachment-block__surface">
      <MediaBlockHeader
        headerClassName="attachment-block__header"
        metaClassName="attachment-block__meta"
        title={title}
        titleSlotClassName="attachment-block__title-slot"
        meta={<MediaBlockMetaText className="attachment-meta">{meta}</MediaBlockMetaText>}
        metaEnd={metaEnd}
        end={action ? <div className="attachment-block__action-slot">{action}</div> : undefined}
      />
      {belowHeader}
    </div>
  );
}
