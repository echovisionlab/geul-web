'use client';

import type { ReactNode } from 'react';
import { LayoutInline, LayoutStack } from '@/components/core/Layout';

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
          <LayoutInline data-media-block-meta-row align="baseline" justify="between" gap="sm" wrap="nowrap">
            <LayoutStack gap="none" flexible>
              {meta}
            </LayoutStack>
            {metaEnd !== undefined ? (
              <LayoutInline gap="none" shrink={false}>
                {metaEnd}
              </LayoutInline>
            ) : null}
          </LayoutInline>
        ) : null}
      </div>
      {end}
    </div>
  );
}
