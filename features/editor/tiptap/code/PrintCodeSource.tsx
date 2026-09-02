'use client';

import { useEffect, useState } from 'react';
import classes from './PrintCodeSource.module.css';

type HighlightStatus = 'loading' | 'ready' | 'fallback';

export interface PrintCodeSourceProps {
  language: string;
  source: string;
}

export function PrintCodeSource({ language, source }: PrintCodeSourceProps) {
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [status, setStatus] = useState<HighlightStatus>('loading');

  useEffect(() => {
    let active = true;
    setHighlighted(null);
    setStatus('loading');
    void import('shiki/bundle/full')
      .then(({ codeToHtml }) =>
        codeToHtml(source, {
          lang: language || 'text',
          themes: { light: 'github-light', dark: 'github-dark' },
          defaultColor: false,
        }),
      )
      .then((html) => {
        if (active) {
          setHighlighted(html);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (active) {
          setStatus('fallback');
        }
      });
    return () => {
      active = false;
    };
  }, [language, source]);

  return (
    <div className={classes.root} data-print-code-source="" data-highlight-status={status}>
      {highlighted ? (
        <div className={classes.highlighted} dangerouslySetInnerHTML={{ __html: highlighted }} />
      ) : (
        <pre className={classes.fallback}>
          <code>{source}</code>
        </pre>
      )}
    </div>
  );
}
