'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { IconMarkdown, IconPencil, IconPrinter, IconShare } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Box, Group, Image, Stack, Text, Title } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconButton } from '@/components/core/IconButton';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { Tooltip } from '@/components/core/Tooltip';
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
  onShare: () => void;
  onExport: (format: 'markdown' | 'pdf') => void;
  languageMenu?: ReactNode;
}

export function PostHeader({ post, onShare, onExport, languageMenu }: PostHeaderProps) {
  const dateTime = useDateTimeFormatter();
  const t = useTranslations('postHeader');
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonStates = useTranslations('common.states');
  const tFeaturedImage = useTranslations('featuredImage');
  const isMobile = useMediaQuery('(max-width: 48em)');
  const unknownUserLabel = tCommon('states.unknown');
  const renderDetailRow = (label: string, value: string | null, options?: { valueColor?: string }) =>
    value ? (
      <PublicMetadataRow label={label}>
        <Text size="sm" component="span" c={options?.valueColor ?? 'inherit'}>
          {value}
        </Text>
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
      <Text key={key} size="sm" component="span">
        {name}
      </Text>
    );
  };

  const renderCollaboratorLinks = (collaborators: Collaborator[]) =>
    collaborators.flatMap((user, index) => {
      const displayName = user.name || unknownUserLabel;
      const nodes: ReactNode[] = [];

      if (index > 0) {
        nodes.push(
          <Text key={`separator-${user.id}`} size="sm" component="span" c="inherit">
            ,
          </Text>,
        );
      }

      nodes.push(
        <PublicMetadataLink key={user.id} href={`/user/${user.id}`} ariaLabel={displayName}>
          {displayName}
        </PublicMetadataLink>,
      );

      return nodes;
    });

  const actionButtons = (
    <Group gap="xs" className="print-hide">
      {languageMenu}
      {post.canEdit && (
        <Tooltip label={tCommon('actions.edit')}>
          <IconButton
            size="sm"
            tone="neutral"
            emphasis="low"
            component={Link}
            href={`/posts/${post.id}?edit=true`}
            aria-label={t('actions.editPost')}
          >
            <IconPencil size={16} />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip label={tCommon('actions.share')}>
        <IconButton size="sm" tone="neutral" emphasis="low" aria-label={t('actions.sharePost')} onClick={onShare}>
          <IconShare size={16} />
        </IconButton>
      </Tooltip>
      <Tooltip label={tCommon('actions.print')}>
        <IconButton
          size="sm"
          tone="neutral"
          emphasis="low"
          aria-label={t('actions.printPost')}
          onClick={() => window.print()}
        >
          <IconPrinter size={16} />
        </IconButton>
      </Tooltip>
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
    </Group>
  );

  // Hero Header with Featured Image
  if (post.featuredImageUrl) {
    return (
      <Box
        className={classes.hero}
        style={{
          position: 'relative',
          overflow: 'hidden',
          marginLeft: 'calc(-1 * var(--mantine-spacing-md))',
          marginRight: 'calc(-1 * var(--mantine-spacing-md))',
          marginTop: 'calc(-1 * var(--mantine-spacing-md))',
        }}
      >
        {/* Background image */}
        <Image
          className={classes.heroImage}
          src={buildManagedImageUrl(post.featuredImageUrl, MANAGED_IMAGE_PRESET.HERO_IMAGE)}
          alt={post.title || tFeaturedImage('alt')}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />

        {/* Gradient overlay */}
        <Box
          className={classes.heroOverlay}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.3) 100%)',
          }}
        />

        {/* Content overlay */}
        <Stack
          className={classes.heroContent}
          gap="md"
          style={{
            padding: 'var(--mantine-spacing-xl)',
            justifyContent: isMobile ? 'space-between' : 'flex-end',
            color: 'white',
            minHeight: 'inherit',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {isMobile ? (
            <Group justify="flex-end" className="print-hide">
              {actionButtons}
            </Group>
          ) : (
            <Box
              style={{
                position: 'absolute',
                top: 'var(--mantine-spacing-md)',
                right: 'var(--mantine-spacing-md)',
              }}
            >
              {actionButtons}
            </Box>
          )}

          {/* Title */}
          <Stack className={classes.titleStack} gap="xs">
            <Title
              className={classes.heroTitle}
              order={1}
              style={{
                color: 'white',
                fontWeight: 700,
                fontSize: isMobile ? '1.75rem' : '2rem',
                lineHeight: 1.05,
              }}
            >
              {post.title || tCommon('states.untitled')}
            </Title>
          </Stack>

          {/* Meta Info */}
          <PublicMetadataRows className={classes.heroMetadata} tone="inverse">
            <PublicMetadataRow label={tCommon('labels.authors')} valueAlign="center">
              {post.authors.length > 0 ? (
                <UserInlineLinks
                  users={post.authors}
                  unknownLabel={unknownUserLabel}
                  avatarSize={24}
                  avatarBorderColor="rgba(255, 255, 255, 0.72)"
                  textSize="sm"
                  textColor="rgba(255, 255, 255, 0.88)"
                  separator="slash"
                />
              ) : (
                <Text size="sm" component="span" c="rgba(255,255,255,0.88)">
                  {tCommonStates('anonymous')}
                </Text>
              )}
            </PublicMetadataRow>
            {post.publishedAt &&
              post.updatedAt &&
              post.updatedAt !== post.publishedAt &&
              renderDetailRow(tCommon('labels.updated'), dateTime.dateTime(post.updatedAt), {
                valueColor: 'rgba(255,255,255,0.88)',
              })}
            {!post.publishedAt &&
              post.updatedAt &&
              renderDetailRow(tCommon('labels.lastEdited'), dateTime.dateTime(post.updatedAt), {
                valueColor: 'rgba(255,255,255,0.88)',
              })}
            {post.locationPlace && (
              <LocationPlaceMetadataRows
                place={post.locationPlace}
                labelColor="rgba(255,255,255,0.72)"
                valueColor="rgba(255,255,255,0.88)"
                textSize="sm"
                coordinateVisibility="desktop"
              />
            )}
            {post.categories && post.categories.length > 0 && (
              <PublicMetadataRow label={tCommonEntities('categories')}>
                <PublicMetadataValueGroup>
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
                <PublicMetadataValueGroup>
                  {post.tags.map((tag) =>
                    renderMetaLink(tag.id, tag.name, tag.slug ? `/tag/${encodeURIComponent(tag.slug)}` : undefined),
                  )}
                </PublicMetadataValueGroup>
              </PublicMetadataRow>
            )}
          </PublicMetadataRows>
        </Stack>
      </Box>
    );
  }

  // Standard Header without Featured Image
  return (
    <>
      <Group justify="space-between" align="flex-start">
        <Stack gap="xs" style={{ flex: 1 }}>
          <Title order={1} style={{ fontWeight: 700, fontSize: '1.5rem' }}>
            {post.title || tCommon('states.untitled')}
          </Title>
        </Stack>
        {actionButtons}
      </Group>

      {/* Meta Info */}
      <PublicMetadataRows>
        <PublicMetadataRow label={tCommon('labels.authors')} valueAlign="center">
          {post.authors.length > 0 ? (
            <UserInlineLinks
              users={post.authors}
              unknownLabel={unknownUserLabel}
              avatarSize={24}
              textSize="sm"
              separator="slash"
            />
          ) : (
            <Text size="sm" component="span" c="dimmed">
              {tCommonStates('anonymous')}
            </Text>
          )}
        </PublicMetadataRow>
        {post.collaborators.length > 0 && (
          <PublicMetadataRow label={tCommon('labels.collaborators')}>
            <PublicMetadataValueGroup>{renderCollaboratorLinks(post.collaborators)}</PublicMetadataValueGroup>
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
          <LocationPlaceMetadataRows place={post.locationPlace} textSize="sm" coordinateVisibility="desktop" />
        )}
        {post.categories && post.categories.length > 0 && (
          <PublicMetadataRow label={tCommonEntities('categories')}>
            <PublicMetadataValueGroup>
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
            <PublicMetadataValueGroup>
              {post.tags.map((tag) =>
                renderMetaLink(tag.id, tag.name, tag.slug ? `/tag/${encodeURIComponent(tag.slug)}` : undefined),
              )}
            </PublicMetadataValueGroup>
          </PublicMetadataRow>
        )}
      </PublicMetadataRows>
    </>
  );
}
