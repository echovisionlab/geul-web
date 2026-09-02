'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useDebouncedValue } from '@mantine/hooks';
import { previewEmailLayoutContentAction } from '@/lib/actions/email-layout';
import { normalizeLocale } from '@/lib/i18n/locale';
import { previewEmailLayout } from '@/lib/queries/email-layout';
import type { EmailLayoutValidationError } from '@/lib/types/email-layout/validation';
import { EmailLayoutPreviewView } from './EmailLayoutPreviewView';

interface EmailLayoutPreviewProps {
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
}: EmailLayoutPreviewProps) {
  const tPreviewSample = useTranslations('adminList.emailLayouts.detail.previewSample');
  const [debouncedHtml] = useDebouncedValue(htmlContent, debounceMs);
  const [debouncedRefreshKey] = useDebouncedValue(refreshKey ?? htmlContent, debounceMs);
  const [previewHtml, setPreviewHtml] = useState('');
  const [errors, setErrors] = useState<EmailLayoutValidationError[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sampleContent = useMemo(
    () =>
      `<h1>${tPreviewSample('headline')}</h1><p>${tPreviewSample('bodyPrimary')}</p><p>${tPreviewSample('bodySecondary')}</p>`,
    [tPreviewSample],
  );

  const fetchPreview = useCallback(
    async (content: string) => {
      const requestedPreviewLocale = normalizeLocale(locale) ?? 'en';
      const normalizedSourceLocale = normalizeLocale(sourceLocale) ?? 'en';
      const useSavedLocalizedLayout = Boolean(layoutId) && requestedPreviewLocale !== normalizedSourceLocale;

      if (!useSavedLocalizedLayout && !content.trim()) {
        setPreviewHtml('');
        setErrors([]);
        return;
      }

      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();
      setIsLoading(true);
      try {
        if (useSavedLocalizedLayout && layoutId) {
          const result = await previewEmailLayout(layoutId, sampleContent, requestedPreviewLocale);
          setPreviewHtml(result?.html ?? '');
          setErrors(result ? [] : [{ code: 'UNKNOWN_ERROR', message: '' }]);
          return;
        }

        const result = await previewEmailLayoutContentAction(content, sampleContent, requestedPreviewLocale);
        setPreviewHtml(result.html);
        setErrors(result.errors);
      } catch {
        setPreviewHtml('');
        setErrors([{ code: 'UNKNOWN_ERROR', message: '' }]);
      } finally {
        setIsLoading(false);
      }
    },
    [layoutId, locale, sampleContent, sourceLocale],
  );

  useEffect(() => {
    void fetchPreview(debouncedHtml);
  }, [debouncedHtml, debouncedRefreshKey, fetchPreview]);

  return <EmailLayoutPreviewView previewHtml={previewHtml} errors={errors} isLoading={isLoading} locale={locale} />;
}
