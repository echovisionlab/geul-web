import type { ReactNode } from 'react';
import type { DocumentLayoutViewModel } from './types';
import classes from './ContentLayoutView.module.css';

export interface ContentLayoutViewProps {
  layout: DocumentLayoutViewModel;
  chrome?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ContentLayoutView({ layout, chrome, children, className }: ContentLayoutViewProps) {
  const chromeIsPinned = layout.pageChrome === 'pinned';
  const rootClassName = [classes.root, className].filter(Boolean).join(' ');

  return (
    <div
      className={rootClassName}
      data-content-layout
      data-content-height={layout.contentHeight}
      data-page-chrome={layout.pageChrome}
      data-footer-layout={layout.footer}
      data-has-chrome={chrome ? 'true' : 'false'}
    >
      {chrome && chromeIsPinned ? <div className={classes.pinnedChrome}>{chrome}</div> : null}
      <div className={classes.body} data-content-body>
        {chrome && !chromeIsPinned ? <div className={classes.flowChrome}>{chrome}</div> : null}
        {children}
      </div>
    </div>
  );
}
