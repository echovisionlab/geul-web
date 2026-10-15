'use client';

import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ContentOgImageConfig, HomeOgImageConfig } from '@/lib/types/site-setting/config';

type OgPreviewRequest =
  { type: 'home'; config: HomeOgImageConfig } | { type: 'content'; title: string; config: ContentOgImageConfig };

/** Retain the last image during updates; cancelled requests cannot replace it. */
export function useOgPreview(request: OgPreviewRequest, enabled = true) {
  const query = useQuery({
    queryKey: ['og-preview', request],
    enabled: enabled && (request.type === 'home' || Boolean(request.title.trim())),
    retry: false,
    gcTime: 0,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/og-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal,
      });
      if (!response.ok) {
        throw Object.assign(new Error('Failed to generate preview'), { status: response.status });
      }
      return response.blob();
    },
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!query.data) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(query.data);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [query.data]);
  return { ...query, previewUrl };
}
