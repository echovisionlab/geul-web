import type { ReactNode } from 'react';
import { Text } from '@/components/core/Typography';
import { LayoutInset } from '@/components/core/Layout';
import './MediaBlockShell.css';

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ');
}

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
    <div className={joinClassNames('media-block__caption', className)}>
      <LayoutInset blockStart="xs">
        <Text size="xs" tone="muted">
          {children}
        </Text>
      </LayoutInset>
    </div>
  );
}

export function MediaBlockMetaText({ className, children }: MediaBlockMetaTextProps) {
  if (children === undefined || children === null || children === false || children === '') {
    return null;
  }

  return (
    <span className={className}>
      <Text as="span" size="xs" tone="muted">
        {children}
      </Text>
    </span>
  );
}
