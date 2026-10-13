'use client';

import { useColorScheme } from '@/lib/providers/DesignSystemProvider';

import { useEffect, useId, useRef, useState } from 'react';

import { useLocale, useTranslations } from 'next-intl';
import { VisuallyHidden } from '@/components/core/Typography';
import { renderMermaid, type MermaidImage } from './mermaid-renderer';
import classes from './Mermaid.module.css';
import { readMermaidAppearance } from './mermaid-appearance';

type Preview = { status: 'loading' } | { status: 'ready'; image: MermaidImage } | { status: 'error'; detail: string };

export interface MermaidDiagramProps {
  source: string;
  title?: string;
}

export function MermaidDiagram({ source, title }: MermaidDiagramProps) {
  const t = useTranslations('mermaid');
  const locale = useLocale();
  const diagramRef = useRef<HTMLDivElement>(null);
  const captionId = useId();
  const descriptionId = useId();
  const { computedColorScheme: theme, themeId } = useColorScheme();
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
      void renderMermaid(source, theme, controller.signal, readMermaidAppearance(diagramRef.current, theme)).then(
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
  }, [source, theme, themeId, locale]);

  const caption = title?.trim();
  const image = source.trim() && preview.status === 'ready' ? preview.image : undefined;
  const name = caption || image?.accessibleTitle || 'Mermaid';
  const normalize = (value: string) => value.trim().replace(/\s+/gu, ' ');
  const description = [image?.accessibleTitle, image?.accessibleDescription]
    .filter((value): value is string => Boolean(value))
    .filter(
      (value, index, values) =>
        normalize(value) !== normalize(name) &&
        values.findIndex((other) => normalize(other) === normalize(value)) === index,
    )
    .join(' ');

  return (
    <div
      ref={diagramRef}
      className={classes.diagram}
      role={image ? 'img' : 'figure'}
      aria-label={caption ? undefined : name}
      aria-labelledby={caption ? captionId : undefined}
      aria-describedby={image && description ? descriptionId : undefined}
      aria-busy={Boolean(source.trim()) && preview.status === 'loading'}
      data-mermaid-status={!source.trim() ? 'empty' : preview.status}
    >
      {!source.trim() ? (
        <span className={classes.message}>{t('empty')}</span>
      ) : preview.status === 'ready' ? (
        <img src={preview.image.src} width={preview.image.width} alt="" className={classes.image} />
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
      {caption && (
        <span id={captionId} className={classes.caption}>
          {title}
        </span>
      )}
      {image && description && <VisuallyHidden id={descriptionId}>{description}</VisuallyHidden>}
    </div>
  );
}
