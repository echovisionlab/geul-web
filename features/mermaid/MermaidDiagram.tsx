'use client';

import { useEffect, useRef, useState } from 'react';
import { useComputedColorScheme } from '@mantine/core';
import { useLocale, useTranslations } from 'next-intl';
import { renderMermaid, type MermaidImage } from './mermaid-renderer';
import classes from './Mermaid.module.css';

type Preview = { status: 'loading' } | { status: 'ready'; image: MermaidImage } | { status: 'error'; detail: string };

export interface MermaidDiagramProps {
  source: string;
  title?: string;
}

export function MermaidDiagram({ source, title }: MermaidDiagramProps) {
  const t = useTranslations('mermaid');
  const locale = useLocale();
  const diagramRef = useRef<HTMLElement>(null);
  const theme = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const [preview, setPreview] = useState<Preview>({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    setPreview({ status: 'loading' });
    if (!source.trim()) {
      return () => controller.abort();
    }
    const timer = setTimeout(() => {
      if (!diagramRef.current) {
        return;
      }
      const styles = getComputedStyle(diagramRef.current);
      void renderMermaid(source, theme, controller.signal, {
        fontFamily: styles.fontFamily,
        fontSize: styles.fontSize,
        background: styles.getPropertyValue('--mantine-color-body').trim(),
        foreground: styles.getPropertyValue('--mantine-color-text').trim(),
        surface: styles.getPropertyValue('--mantine-color-default').trim(),
        border: styles.getPropertyValue('--mantine-color-default-border').trim(),
        line: styles.getPropertyValue('--mantine-color-dimmed').trim(),
      }).then(
        (image) => {
          if (!controller.signal.aborted) {
            setPreview({ status: 'ready', image });
          }
        },
        (error: unknown) => {
          if (!controller.signal.aborted) {
            setPreview({ status: 'error', detail: error instanceof Error ? error.message : '' });
          }
        },
      );
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [source, theme, locale]);

  return (
    <figure
      ref={diagramRef}
      className={classes.diagram}
      aria-label={title || 'Mermaid'}
      aria-busy={Boolean(source.trim()) && preview.status === 'loading'}
    >
      {!source.trim() ? (
        <span className={classes.message}>{t('empty')}</span>
      ) : preview.status === 'ready' ? (
        <img src={preview.image.src} width={preview.image.width} alt={title || 'Mermaid'} className={classes.image} />
      ) : preview.status === 'error' ? (
        <div role="alert" className={classes.error}>
          <span>{t('invalid')}</span>
          <pre>{preview.detail}</pre>
        </div>
      ) : (
        <span role="status" className={classes.message}>
          {t('loading')}
        </span>
      )}
      {title && <figcaption className={classes.caption}>{title}</figcaption>}
    </figure>
  );
}
