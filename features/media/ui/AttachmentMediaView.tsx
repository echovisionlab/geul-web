import type { ReactNode } from 'react';
import { AttachmentSurface } from './AttachmentSurface';
import { MediaBlockCaption, MediaBlockShell } from './MediaBlockShell';

interface AttachmentMediaViewProps {
  title: ReactNode;
  meta: string;
  action?: ReactNode;
  caption?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function AttachmentMediaView({ title, meta, action, caption, className, style }: AttachmentMediaViewProps) {
  return (
    <MediaBlockShell
      className={joinClassNames('attachment-block', className)}
      style={style}
      bodyClassName="attachment-block__content"
    >
      <AttachmentSurface
        title={title}
        meta={meta}
        action={action}
        belowHeader={
          typeof caption === 'string' || caption === undefined ? (
            <MediaBlockCaption>{caption}</MediaBlockCaption>
          ) : (
            caption
          )
        }
      />
    </MediaBlockShell>
  );
}
