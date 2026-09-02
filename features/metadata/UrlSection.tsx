'use client';

import { useTranslations } from 'next-intl';
import type { TextInputProps } from '@/components/core/Input';
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard';
import { UrlSectionView, type UrlSectionViewLabels } from './ui/UrlSectionView';

export type UrlEntityType =
  'post' | 'page' | 'work' | 'form' | 'label' | 'artist' | 'release' | 'program_event' | 'program_event_series';

export interface UrlSectionProps {
  baseUrl: string;
  entityType: UrlEntityType;
  entityId: string;
  slug: string;
  idPrefix?: string;
  error?: string;
  saving?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
  inputProps?: Partial<TextInputProps>;
}

const ENTITY_PATH_MAP: Record<UrlEntityType, string> = {
  post: 'post',
  page: '',
  work: 'work',
  form: 'forms',
  label: 'label',
  artist: 'artist',
  release: 'release',
  program_event: 'events',
  program_event_series: 'event-series',
};

export function UrlSection({ baseUrl, entityType, entityId, slug, ...viewProps }: UrlSectionProps) {
  const t = useTranslations('urlSection');
  const tCommonActions = useTranslations('common.actions');
  const tCommonLabels = useTranslations('common.labels');
  const { copy } = useCopyToClipboard();
  const siteOrigin = baseUrl.replace(/\/$/, '');
  const basePath = ENTITY_PATH_MAP[entityType];
  const publicUrlById = basePath ? `${siteOrigin}/${basePath}/${entityId}` : `${siteOrigin}/${entityId}`;
  const publicUrlBySlug = slug ? (basePath ? `${siteOrigin}/${basePath}/${slug}` : `${siteOrigin}/${slug}`) : null;
  const labels: UrlSectionViewLabels = {
    title: tCommonLabels('url'),
    description: t('description'),
    id: tCommonLabels('id'),
    slug: tCommonLabels('slug'),
    slugPlaceholder: t('placeholders.slug'),
    publicUrl: t('fields.publicUrl'),
    copyId: t('actions.copyId'),
    copyUrl: t('actions.copyUrl'),
    openInNewTab: tCommonActions('openInNewTab'),
  };

  const handleCopy = (text: string, label: string) => {
    copy(text, { successMessage: t('notifications.copied', { label }) });
  };

  return (
    <UrlSectionView
      {...viewProps}
      entityId={entityId}
      slug={slug}
      publicUrlById={publicUrlById}
      publicUrlBySlug={publicUrlBySlug}
      labels={labels}
      onCopyId={() => handleCopy(entityId, labels.id)}
      onCopyUrl={(url) => handleCopy(url, labels.title)}
    />
  );
}
