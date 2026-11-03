'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useDebouncedValue } from '@mantine/hooks';
import { previewEmailLayoutContentAction } from '@/lib/actions/email-layout';
import { PageLoader } from '@/features/site/PageLoader';
import { normalizeLocale } from '@/lib/i18n/locale';
import { previewEmailLayout } from '@/lib/queries/email-layout';
import type { EmailLayoutValidationError } from '@/lib/types/email-layout/validation';
import { EmailLayoutPreviewView } from './EmailLayoutPreviewView';

export interface EmailLayoutPreviewBindings {
  content: (
    html: string,
    sampleContent?: string,
    locale?: string,
    signal?: AbortSignal,
  ) => ReturnType<typeof previewEmailLayoutContentAction>;
  saved: (
    layoutId: string,
    sampleContent?: string,
    locale?: string,
    signal?: AbortSignal,
  ) => ReturnType<typeof previewEmailLayout>;
}
const defaultBindings: EmailLayoutPreviewBindings = {
  // Next server actions cannot accept an AbortSignal. Keep their serialized
  // arguments unchanged; the effect also fences responses after cancellation.
  content: (html, sampleContent, locale) => previewEmailLayoutContentAction(html, sampleContent, locale),
  saved: (layoutId, sampleContent, locale) => previewEmailLayout(layoutId, sampleContent, locale),
};

interface EmailLayoutPreviewProps {
  bindings?: EmailLayoutPreviewBindings;
  layoutId?: string;
  htmlContent: string;
  refreshKey?: string;
  locale?: string;
  sourceLocale?: string | null;
  debounceMs?: number;
}

export function EmailLayoutPreview({
  layoutId,
  htmlContent,
  refreshKey,
  locale,
  sourceLocale,
  debounceMs = 500,
  bindings = defaultBindings,
}: EmailLayoutPreviewProps) {
  const tPreviewSample = useTranslations('adminList.emailLayouts.detail.previewSample');
  const tStates = useTranslations('common.states');
  const [debouncedHtml] = useDebouncedValue(htmlContent, debounceMs);
  const [debouncedRefreshKey] = useDebouncedValue(refreshKey ?? htmlContent, debounceMs);
  const previewTarget = `${layoutId ?? ''}:${locale ?? ''}`;
  const resultTargetRef = useRef(previewTarget);
  const [previewHtml, setPreviewHtml] = useState('');
  const [errors, setErrors] = useState<EmailLayoutValidationError[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const sampleContent = useMemo(
    () =>
      `<h1>${tPreviewSample('headline')}</h1><p>${tPreviewSample('bodyPrimary')}</p><p>${tPreviewSample('bodySecondary')}</p>`,
    [tPreviewSample],
  );

  useEffect(() => {
    const controller = new AbortController();
    const fetchPreview = async () => {
      const requestedPreviewLocale = normalizeLocale(locale) ?? 'en';
      const normalizedSourceLocale = normalizeLocale(sourceLocale) ?? 'en';
      const useSavedLocalizedLayout = Boolean(layoutId) && requestedPreviewLocale !== normalizedSourceLocale;

      if (!useSavedLocalizedLayout && !debouncedHtml.trim()) {
        resultTargetRef.current = previewTarget;
        setPreviewHtml('');
        setErrors([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        if (useSavedLocalizedLayout && layoutId) {
          const result = await bindings.saved(layoutId, sampleContent, requestedPreviewLocale, controller.signal);
          if (controller.signal.aborted) {
            return;
          }
          resultTargetRef.current = previewTarget;
          setPreviewHtml(result?.html ?? '');
          setErrors(result ? [] : [{ code: 'UNKNOWN_ERROR', message: '' }]);
          return;
        }

        const result = await bindings.content(debouncedHtml, sampleContent, requestedPreviewLocale, controller.signal);
        if (controller.signal.aborted) {
          return;
        }
        resultTargetRef.current = previewTarget;
        setPreviewHtml(result.html);
        setErrors(result.errors);
      } catch {
        if (controller.signal.aborted) {
          return;
        }
        resultTargetRef.current = previewTarget;
        setPreviewHtml('');
        setErrors([{ code: 'UNKNOWN_ERROR', message: '' }]);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };
    void fetchPreview();
    return () => controller.abort();
  }, [bindings, debouncedHtml, debouncedRefreshKey, layoutId, locale, sampleContent, sourceLocale, previewTarget]);

  return (
    <EmailLayoutPreviewView
      previewHtml={resultTargetRef.current === previewTarget ? previewHtml : ''}
      errors={resultTargetRef.current === previewTarget ? errors : []}
      isLoading={isLoading || resultTargetRef.current !== previewTarget}
      loadingSurface={<PageLoader placement="flow" message={tStates('loadingPreview')} />}
    />
  );
}
