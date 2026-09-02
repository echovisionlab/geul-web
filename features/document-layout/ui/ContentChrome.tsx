import type { ReactNode } from 'react';
import { Title } from '@mantine/core';
import classes from './ContentChrome.module.css';

export interface ContentChromeProps {
  title?: ReactNode;
  controls?: ReactNode;
  children?: ReactNode;
  tone?: 'default' | 'inverse';
  className?: string;
}

export function ContentChrome({ title, controls, children, tone = 'default', className }: ContentChromeProps) {
  return (
    <div className={[classes.root, className].filter(Boolean).join(' ')} data-content-chrome data-tone={tone}>
      {children ?? (
        <>
          <div className={classes.titleSlot}>
            {title ? (
              <Title order={1} className={classes.title}>
                {title}
              </Title>
            ) : null}
          </div>
          {controls ? <div className={`${classes.controls} print-hide`}>{controls}</div> : null}
        </>
      )}
    </div>
  );
}
