'use client';

import type { CSSProperties } from 'react';
import { IconWorld } from '@tabler/icons-react';
import { LayoutInline, LayoutStack } from '@/components/core/Layout';
import { MediaImage } from '@/components/core/MediaImage';
import { SectionCard } from '@/components/core/Section';
import { Text } from '@/components/core/Typography';
import classes from './LinkCardView.module.css';

export interface LinkCardViewProps {
  url: string;
  title: string;
  description?: string;
  siteName?: string;
  /** Delivery URL of the stored thumbnail File; never the linked site's own image. */
  thumbnailUrl?: string | null;
  /** While a preview is being read, the card shows the host and this status. */
  loadingLabel?: string;
  /** Published content links out; the editor renders the same card without navigation. */
  interactive?: boolean;
  style?: CSSProperties;
}

export function linkCardHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./u, '');
  } catch {
    return url;
  }
}

/** A standalone paragraph link presented as a card: title, description, site and thumbnail. */
export function LinkCardView({
  url,
  title,
  description,
  siteName,
  thumbnailUrl,
  loadingLabel,
  interactive = true,
  style,
}: LinkCardViewProps) {
  const host = linkCardHost(url);
  const site = siteName && siteName.toLowerCase() !== host.toLowerCase() ? `${siteName} · ${host}` : host;
  const body = (
    <SectionCard padding="none" border="all" appearance="surface" clip>
      <div className={classes.layout}>
        <div className={classes.body}>
          <LayoutStack gap="xxs">
            <Text size="sm" weight="strong" lines={2} wrap="anywhere">
              {title || host}
            </Text>
            {loadingLabel ? (
              <Text size="xs" tone="muted" role="status">
                {loadingLabel}
              </Text>
            ) : description ? (
              <Text size="xs" tone="secondary" lines={2}>
                {description}
              </Text>
            ) : null}
            <LayoutInline gap="xxs" align="center" wrap="nowrap">
              <IconWorld size={14} aria-hidden />
              <Text size="xs" tone="muted" truncate flexible>
                {site}
              </Text>
            </LayoutInline>
          </LayoutStack>
        </div>
        {thumbnailUrl ? (
          <div className={classes.thumbnail}>
            <MediaImage src={thumbnailUrl} alt="" fit="cover" fill loading="lazy" />
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
  return (
    <div className={classes.root} style={style} data-link-card="" aria-busy={loadingLabel ? true : undefined}>
      {interactive ? (
        <a className={classes.link} href={url} rel="noopener noreferrer">
          {body}
        </a>
      ) : (
        body
      )}
    </div>
  );
}
