import type { ReactNode } from 'react';
import { tableOfContentsScope } from '@/components/core/TableOfContents/table-of-contents-scope';
import { DOCUMENT_TITLE_HEADING_LEVEL } from './document-heading-level';
import { DocumentHeadingScope } from './DocumentHeadingScope';
import type { DocumentLayoutViewModel } from './types';
import classes from './ContentLayoutView.module.css';

export interface ContentLayoutViewProps {
  layout: DocumentLayoutViewModel;
  /**
   * The document title layer (`ContentChrome`), which renders the document's only `h1`. With chrome the
   * body's authored headings sit one level below the title (authored H1 → `h2`, visual size unchanged);
   * without it the authored levels are the page outline.
   */
  chrome?: ReactNode;
  controls?: ReactNode;
  /** A note about the document in the interface language (e.g. no version in the requested language). */
  notice?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Language of the document content; interface controls retain their own language. */
  contentLanguage?: string;
}

export function ContentLayoutView({
  layout,
  chrome,
  controls,
  notice,
  children,
  className,
  contentLanguage,
}: ContentLayoutViewProps) {
  const chromeIsPinned = layout.pageChrome === 'pinned';
  const rootClassName = [classes.root, className].filter(Boolean).join(' ');

  return (
    <div
      {...tableOfContentsScope}
      className={rootClassName}
      data-content-layout
      data-content-height={layout.contentHeight}
      data-page-chrome={layout.pageChrome}
      data-footer-layout={layout.footer}
      data-has-chrome={chrome ? 'true' : 'false'}
    >
      {controls ? (
        <div className={`${classes.controls} print-hide`} data-content-controls>
          {controls}
        </div>
      ) : null}
      {notice ? (
        <div className={`${classes.notice} print-hide`} data-content-notice>
          {notice}
        </div>
      ) : null}
      {chrome && chromeIsPinned ? (
        <div className={classes.pinnedChrome} lang={contentLanguage}>
          {chrome}
        </div>
      ) : null}
      <div className={classes.body} data-content-body lang={contentLanguage}>
        {chrome && !chromeIsPinned ? <div className={classes.flowChrome}>{chrome}</div> : null}
        <DocumentHeadingScope parentLevel={chrome ? DOCUMENT_TITLE_HEADING_LEVEL : 0}>{children}</DocumentHeadingScope>
      </div>
    </div>
  );
}
