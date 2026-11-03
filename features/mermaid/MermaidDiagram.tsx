'use client';

import { useColorScheme } from '@/lib/providers/DesignSystemProvider';

import { useEffect, useRef, useState } from 'react';

import { useLocale, useTranslations } from 'next-intl';
import { PageLoader } from '@/features/site/PageLoader';
import { renderMermaid } from './mermaid-renderer';
import { MermaidDiagramView, type MermaidDiagramPreviewState } from './MermaidDiagramView';
import { readMermaidAppearance } from './mermaid-appearance';

export interface MermaidDiagramProps {
  source: string;
  title?: string;
}

export function MermaidDiagram({ source, title }: MermaidDiagramProps) {
  const t = useTranslations('mermaid');
  const locale = useLocale();
  const diagramRef = useRef<HTMLDivElement>(null);
  const { computedColorScheme: theme, themeId } = useColorScheme();
  const [preview, setPreview] = useState<MermaidDiagramPreviewState>({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    setPreview((previous) => ({ status: 'loading', image: 'image' in previous ? previous.image : undefined }));
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

  return (
    <MermaidDiagramView
      source={source}
      title={title}
      state={preview}
      diagramRef={diagramRef}
      labels={{ empty: t('empty'), invalid: t('invalid'), loading: t('loading') }}
      loadingSurface={<PageLoader extent="compact" placement="flow" size="sm" message={t('loading')} />}
    />
  );
}
