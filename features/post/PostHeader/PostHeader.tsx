'use client';
import { ImageChrome, Heading as DsHeading, Text as DsText } from '@/components/core/Typography';
import { LayoutInline as DsLayoutInline, LayoutStack as DsLayoutStack } from '@/components/core/Layout';

import { MediaImage } from '@/components/core/MediaImage';
import type { ReactNode } from 'react';
import { IconMarkdown, IconPencil } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

import { IconButton } from '@/components/core/IconButton';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { OnDemandTooltip as Tooltip } from '@/components/core/Tooltip/OnDemandTooltip';
import { LocationPlaceMetadataRows } from '@/features/location/LocationPlaceMetadataRows';
import { UserInlineLinks } from '@/features/user/UserInlineLinks';
import {
  PublicMetadataLink,
  PublicMetadataRow,
  PublicMetadataRows,
  PublicMetadataValueGroup,
} from '@/components/core/PublicMetadata';
import type { LocationPlaceSummary } from '@/lib/utils/location-place';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';
import classes from './PostHeader.module.css';

interface Author {
  id: string;
  name: string | null;
  image: string | null;
}

interface Collaborator {
  id: string;
  name: string | null;
  image: string | null;
  role: string;
}

interface Category {
  id: string;
  name: string;
  slug?: string | null;
}

interface Tag {
  id: string;
  name: string;
  slug?: string | null;
}

interface PostHeaderPost {
  id: string;
  slug: string | null;
  title: string | null;
  summary: string | null;
  featuredImageUrl: string | null;
  publishedAt: Date | null;
  updatedAt: Date | null;
  canEdit: boolean;
  authors: Author[];
  collaborators: Collaborator[];
  categories: Category[] | null;
  tags: Tag[] | null;
  locationPlace: LocationPlaceSummary | null;
}

interface PostHeaderProps {
  post: PostHeaderPost;
  onExport: (format: 'markdown' | 'pdf') => void;
  /** Interface-language content locale menu; shares the header action row instead of floating over it. */
  languageControl?: ReactNode;
}

export function PostHeader({ post, onExport, languageControl }: PostHeaderProps) {
  const dateTime = useDateTimeFormatter();
  const t = useTranslations('postHeader');
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonStates = useTranslations('common.states');
  const tFeaturedImage = useTranslations('featuredImage');
  const unknownUserLabel = tCommon('states.unknown');
  const inverse = !!post.featuredImageUrl;

  const renderDetailRow = (label: string, value: string | null) =>
    value ? (
      <PublicMetadataRow label={label}>
        <DsText size="sm" as="span" tone="inherit">
          {value}
        </DsText>
      </PublicMetadataRow>
    ) : null;

  const renderMetaLink = (key: string, name: string, href?: string) => {
    if (href) {
      return (
        <PublicMetadataLink key={key} href={href} ariaLabel={name}>
          {name}
        </PublicMetadataLink>
      );
    }

    return (
      <DsText key={key} size="sm" as="span" tone="inherit">
        {name}
      </DsText>
    );
  };

  const actions = (
    <div className="print-hide">
      <DsLayoutInline gap="xs" align="center" wrap="nowrap">
        {post.canEdit && (
          <Tooltip label={tCommon('actions.edit')}>
            <IconButton
              size="sm"
              tone="neutral"
              emphasis="low"
              href={`/posts/${post.id}?edit=true`}
              aria-label={t('actions.editPost')}
            >
              <IconPencil size={16} />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip label={tCommon('actions.markdown')}>
          <IconButton
            size="sm"
            tone="neutral"
            emphasis="low"
            aria-label={t('actions.exportMarkdown')}
            onClick={() => onExport('markdown')}
          >
            <IconMarkdown size={16} />
          </IconButton>
        </Tooltip>
        {languageControl}
      </DsLayoutInline>
    </div>
  );

  const title = post.title || tCommon('states.untitled');

  // Plain and hero headers present the same metadata rows; only the tone follows the surface.
  const metadata = (
    <PublicMetadataRows tone={inverse ? 'inverse' : 'default'}>
      <PublicMetadataRow label={tCommon('labels.authors')} valueAlign="center">
        {post.authors.length > 0 ? (
          <UserInlineLinks
            users={post.authors}
            unknownLabel={unknownUserLabel}
            avatarSize="sm"
            textSize="sm"
            textColor={inverse ? 'inverse' : undefined}
            separator="slash"
          />
        ) : (
          <DsText size="sm" as="span" tone={inverse ? 'inverse' : 'secondary'}>
            {tCommonStates('anonymous')}
          </DsText>
        )}
      </PublicMetadataRow>
      {post.collaborators.length > 0 && (
        <PublicMetadataRow label={tCommon('labels.collaborators')}>
          <PublicMetadataValueGroup separator="slash">
            {post.collaborators.map((user) => {
              const displayName = user.name || unknownUserLabel;
              return (
                <PublicMetadataLink key={user.id} href={`/user/${user.id}`} ariaLabel={displayName}>
                  {displayName}
                </PublicMetadataLink>
              );
            })}
          </PublicMetadataValueGroup>
        </PublicMetadataRow>
      )}
      {post.publishedAt &&
        post.updatedAt &&
        post.updatedAt !== post.publishedAt &&
        renderDetailRow(tCommon('labels.updated'), dateTime.dateTime(post.updatedAt))}
      {!post.publishedAt &&
        post.updatedAt &&
        renderDetailRow(tCommon('labels.lastEdited'), dateTime.dateTime(post.updatedAt))}
      {post.locationPlace && (
        <LocationPlaceMetadataRows
          place={post.locationPlace}
          labelColor={inverse ? 'inverse-secondary' : undefined}
          valueColor={inverse ? 'inverse' : undefined}
          textSize="sm"
          coordinateVisibility="desktop"
        />
      )}
      {post.categories && post.categories.length > 0 && (
        <PublicMetadataRow label={tCommonEntities('categories')}>
          <PublicMetadataValueGroup separator="slash">
            {post.categories.map((category) =>
              renderMetaLink(
                category.id,
                category.name,
                category.slug ? `/category/${encodeURIComponent(category.slug)}` : undefined,
              ),
            )}
          </PublicMetadataValueGroup>
        </PublicMetadataRow>
      )}
      {post.tags && post.tags.length > 0 && (
        <PublicMetadataRow label={tCommonEntities('tags')}>
          <PublicMetadataValueGroup separator="slash">
            {post.tags.map((tag) =>
              renderMetaLink(tag.id, tag.name, tag.slug ? `/tag/${encodeURIComponent(tag.slug)}` : undefined),
            )}
          </PublicMetadataValueGroup>
        </PublicMetadataRow>
      )}
    </PublicMetadataRows>
  );

  // Hero Header with Featured Image
  if (post.featuredImageUrl) {
    return (
      <div className={classes.hero} data-post-hero>
        <div className={classes.heroImage}>
          <MediaImage
            fill
            src={buildManagedImageUrl(post.featuredImageUrl, MANAGED_IMAGE_PRESET.HERO_IMAGE)}
            alt={post.title || tFeaturedImage('alt')}
          />
        </div>
        <ImageChrome placement="cover" shade="header" aria-hidden />
        <div className={classes.heroContent}>
          <div className={classes.heroActions}>
            <ImageChrome>{actions}</ImageChrome>
          </div>
          {/* Public detail title → metadata: xs + the rows' own xs offset = 16px, as in the plain header. */}
          <ImageChrome inset="md" gap="xs">
            <DsHeading contrast="image" tone="inverse" level={1} scale="title" wrap="anywhere">
              {title}
            </DsHeading>
            {metadata}
          </ImageChrome>
        </div>
      </div>
    );
  }

  // Standard Header without Featured Image
  return (
    <DsLayoutStack gap="xs">
      <DsLayoutInline justify="between" align="start" wrap="nowrap">
        <DsLayoutStack flexible>
          <DsHeading level={1} scale="title" wrap="anywhere">
            {title}
          </DsHeading>
        </DsLayoutStack>
        <div className={classes.titleActions}>{actions}</div>
      </DsLayoutInline>
      {metadata}
    </DsLayoutStack>
  );
}
