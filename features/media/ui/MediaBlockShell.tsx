import type { CSSProperties, ReactNode } from 'react';
import './MediaBlockShell.css';

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ');
}

const MEDIA_BLOCK_CAPTION_STYLE: CSSProperties = {
  marginTop: '0.5rem',
  fontSize: '0.6875rem',
  lineHeight: 1.4,
  color: 'var(--mantine-color-dimmed)',
  textAlign: 'left',
  display: 'block',
  width: '100%',
  minHeight: '20px',
};

const MEDIA_BLOCK_META_STYLE: CSSProperties = {
  fontSize: '0.6875rem',
  lineHeight: 1.2,
  color: 'var(--mantine-color-dimmed)',
  textAlign: 'left',
};

interface MediaBlockShellProps {
  as?: 'div' | 'figure';
  className: string;
  bodyClassName?: string;
  style?: React.CSSProperties;
  domAttrs?: Record<string, string | undefined>;
  header?: ReactNode;
  caption?: ReactNode;
  children: ReactNode;
}

export function MediaBlockShell({
  as = 'div',
  className,
  bodyClassName,
  style,
  domAttrs,
  header,
  caption,
  children,
}: MediaBlockShellProps) {
  const Component = as;
  const body = (
    <>
      {header}
      {children}
      {caption}
    </>
  );

  return (
    <Component {...domAttrs} className={className} style={style}>
      {bodyClassName ? <div className={joinClassNames(bodyClassName)}>{body}</div> : body}
    </Component>
  );
}

interface MediaBlockCaptionProps {
  className?: string;
  children?: ReactNode;
}

interface MediaBlockMetaTextProps {
  className?: string;
  children?: ReactNode;
}

export function MediaBlockCaption({ className, children }: MediaBlockCaptionProps) {
  if (children === undefined || children === null || children === false || children === '') {
    return null;
  }

  return (
    <div className={joinClassNames('media-block__caption', className)} style={MEDIA_BLOCK_CAPTION_STYLE}>
      {children}
    </div>
  );
}

export function MediaBlockMetaText({ className, children }: MediaBlockMetaTextProps) {
  if (children === undefined || children === null || children === false || children === '') {
    return null;
  }

  return (
    <span className={className} style={MEDIA_BLOCK_META_STYLE}>
      {children}
    </span>
  );
}
