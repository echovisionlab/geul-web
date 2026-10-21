'use client';

import type { CSSProperties, ReactNode } from 'react';
import { IconWorld } from '@tabler/icons-react';
import { Spinner } from '@/components/core/Display';
import { LayoutInline, LayoutStack } from '@/components/core/Layout';
import { MediaImage } from '@/components/core/MediaImage';
import { SectionCard } from '@/components/core/Section';
import { Text } from '@/components/core/Typography';
import classes from './LinkCardView.module.css';

export interface LinkCardViewProps {
  url: string;
  /** Empty when the link text is the bare URL; the card then shows the host. */
  title: string;
  description?: string;
  /** Delivery URL of the stored thumbnail File; never the linked site's own image. */
  thumbnailUrl?: string | null;
  /** Delivery URL of the stored site icon File. */
  iconUrl?: string | null;
  /** While a preview is being read, the title row shows this status. */
  loadingLabel?: string;
  /** Published content shows its caption; the editor passes its own caption editor instead. */
  caption?: ReactNode;
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

/**
 * A standalone paragraph link presented as a card, after Notion's bookmark:
 * a one-line title, a two-line description and the site icon with the URL,
 * beside a thumbnail that gives way when the card is too narrow for both.
 */
export function LinkCardView({
  url,
  title,
  description,
  thumbnailUrl,
  iconUrl,
  loadingLabel,
  caption,
  interactive = true,
  style,
}: LinkCardViewProps) {
  const body = (
    <SectionCard padding="none" border="all" appearance="surface" clip>
      <div className={classes.layout}>
        <div className={classes.body}>
          <LayoutStack gap="xxs">
            {loadingLabel ? (
              <LayoutInline gap="xs" align="center" wrap="nowrap" role="status">
                <Spinner size="xs" />
                <Text size="sm" tone="secondary" truncate>
                  {loadingLabel}
                </Text>
              </LayoutInline>
            ) : (
              <Text size="sm" weight="medium" truncate>
                {title || linkCardHost(url)}
              </Text>
            )}
            {description && !loadingLabel ? (
              <Text size="xs" tone="secondary" lines={2}>
                {description}
              </Text>
            ) : null}
            <LayoutInline gap="xs" align="center" wrap="nowrap">
              {iconUrl ? (
                <span className={classes.icon}>
                  <MediaImage src={iconUrl} alt="" fit="contain" fill />
                </span>
              ) : (
                <IconWorld size={16} aria-hidden />
              )}
              <Text size="xs" truncate flexible>
                {url}
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
    <figure className={classes.root} style={style} data-link-card="" aria-busy={loadingLabel ? true : undefined}>
      {interactive ? (
        <a className={classes.link} href={url} rel="noopener noreferrer">
          {body}
        </a>
      ) : (
        body
      )}
      {caption ? <figcaption className={classes.caption}>{caption}</figcaption> : null}
    </figure>
  );
}
