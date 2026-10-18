import type { ReactNode } from 'react';
import { Heading, ImageChrome } from '@/components/core/Typography';
import { LayoutContainer, LayoutStack } from '@/components/core/Layout';
import classes from './ContentChrome.module.css';

export interface ContentChromeProps {
  title?: ReactNode;
  children?: ReactNode;
  tone?: 'default' | 'inverse';
  /**
   * `reading` puts the chrome on the body's reading column: the `reading` measure from the start edge,
   * clear of the outline's reserved inline space (from the document's table-of-contents scope), on screen only.
   * `full` (default) spans the document width, for full-bleed headers such as heroes and image grids.
   */
  measure?: 'full' | 'reading';
  className?: string;
}

export function ContentChrome({ title, children, tone = 'default', measure = 'full', className }: ContentChromeProps) {
  const content = (
    <LayoutStack gap={{ base: 'sm', sm: 'md' }}>
      {children ??
        (title ? (
          <Heading
            level={1}
            scale="title"
            tone={tone === 'inverse' ? 'inverse' : 'primary'}
            contrast={tone === 'inverse' ? 'image' : 'default'}
            wrap="anywhere"
          >
            {title}
          </Heading>
        ) : null)}
    </LayoutStack>
  );
  const toned = tone === 'inverse' ? <ImageChrome>{content}</ImageChrome> : content;
  return (
    <div
      className={
        [measure === 'reading' ? classes.reading : undefined, className].filter(Boolean).join(' ') || undefined
      }
      data-content-chrome
      data-tone={tone}
      data-measure={measure}
    >
      {measure === 'reading' ? (
        <LayoutContainer size="reading" inset="none" placement="start">
          {toned}
        </LayoutContainer>
      ) : (
        toned
      )}
    </div>
  );
}
