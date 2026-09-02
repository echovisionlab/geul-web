import { IconExternalLink } from '@tabler/icons-react';
import { getTranslations } from 'next-intl/server';
import { Box, Divider, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { LabelBadge } from '@/components/core/Badge';
import {
  PublicMetadataLink,
  PublicMetadataRow,
  PublicMetadataRows,
  PublicMetadataValueGroup,
} from '@/components/core/PublicMetadata';
import { SectionCard } from '@/components/core/Section';
import { JsonLdScript } from '@/features/metadata/ui/JsonLdScript';
import { parseReleaseListProps } from '@/features/page/blocks/releases-gallery/schema';
import { ReleaseListViewClient } from '@/features/page/blocks/releases-gallery/ViewClient';
import { ShareButton } from '@/features/share/ShareButton';
import { GeneratedRichTextBlockView } from '@/features/page/PageView/blocks/GeneratedRichTextBlockView';
import { SocialLinksDisplay } from '@/features/social-links/SocialLinksDisplay';
import { ContentLanguageMenu } from '@/features/translation/ContentLanguageMenu';
import { LocalizationNotice } from '@/features/translation/LocalizationNotice';
import { formatCountryDisplayName } from '@/lib/countries';
import type { getArtistView } from '@/lib/queries/artist';
import type { getArtistMetadataDocument } from '@/lib/queries/metadata';
import { buildArtistJsonLd } from '@/lib/utils/json-ld';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';
import type { SearchParamRecord } from '@/lib/utils/request-path';
import { ArtistWorkSection } from './ArtistWorkSection';
import classes from './page.module.css';

const artistReleaseListProps = parseReleaseListProps({
  limit: '500',
  columns: '8',
  layout: 'grid',
  imageAspectRatio: '1:1',
});

type ArtistView = NonNullable<Awaited<ReturnType<typeof getArtistView>>>;
type ArtistMetadata = NonNullable<Awaited<ReturnType<typeof getArtistMetadataDocument>>>;

function getArtistReleaseArtists(artist: ArtistView) {
  return (release: { artists: { id: string; name: string; slug: string | null }[] }) => {
    const releaseArtists = [{ id: artist.id, name: artist.name, slug: artist.slug }, ...release.artists];
    const seenArtists = new Set<string>();
    return releaseArtists.flatMap((releaseArtist) => {
      const key = releaseArtist.id || releaseArtist.slug || releaseArtist.name;
      if (!key || seenArtists.has(key)) {
        return [];
      }
      seenArtists.add(key);
      return [{ id: key, label: releaseArtist.name, href: `/artists/${releaseArtist.slug || releaseArtist.id}` }];
    });
  };
}

export async function ArtistPublicContent({
  artist,
  artistMetadata,
  baseUrl,
  query,
  requestedLocale,
  uiLocale,
}: {
  artist: ArtistView;
  artistMetadata: ArtistMetadata | null;
  baseUrl: string;
  query: SearchParamRecord;
  requestedLocale: string | null;
  uiLocale: string;
}) {
  const [t, tCommonEntities, tCommonLabels] = await Promise.all([
    getTranslations('artistPage'),
    getTranslations('common.entities'),
    getTranslations('common.labels'),
  ]);
  const url = `${baseUrl}/artists/${artist.slug || artist.id}`;
  const pathname = `/artists/${artist.slug || artist.id}`;
  const contentLocale = requestedLocale ?? uiLocale;
  const hasSocialLinks = artist.socialLinks && Object.keys(artist.socialLinks).length > 0;
  const getReleaseArtists = getArtistReleaseArtists(artist);

  return (
    <>
      {artistMetadata && <JsonLdScript data={buildArtistJsonLd(artistMetadata)} />}
      <Stack gap="xl">
        <LocalizationNotice
          pathname={pathname}
          query={query}
          requestedLocale={contentLocale}
          localizationInfo={artist.localizationInfo}
          variant="subtle"
        />
        <Group align="flex-start" gap="xl" wrap="wrap" className={classes.header}>
          {artist.imageUrl && (
            <Box className={classes.imageContainer}>
              <img
                src={buildManagedImageUrl(artist.imageUrl, MANAGED_IMAGE_PRESET.HEADER_IMAGE) ?? undefined}
                alt={artist.name}
                className={classes.image}
              />
            </Box>
          )}
          <Stack gap="md" className={classes.infoContainer}>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Title order={1}>{artist.name}</Title>
              <Group gap="sm" align="flex-start" wrap="nowrap">
                <ContentLanguageMenu
                  pathname={pathname}
                  query={query}
                  requestedLocale={contentLocale}
                  localizationInfo={artist.localizationInfo}
                />
                <ShareButton url={url} title={artist.name} />
              </Group>
            </Group>
            <Divider />
            <PublicMetadataRows>
              {artist.isGroup && (
                <PublicMetadataRow label={tCommonLabels('type')}>
                  <Text size="sm" component="span">
                    {t('labels.group')}
                  </Text>
                </PublicMetadataRow>
              )}
              {artist.realName && (
                <PublicMetadataRow label={t('details.realName')}>
                  <Text size="sm">{artist.realName}</Text>
                </PublicMetadataRow>
              )}
              {artist.countryCode && (
                <PublicMetadataRow label={tCommonLabels('country')}>
                  <Text size="sm">{formatCountryDisplayName(artist.countryCode, uiLocale)}</Text>
                </PublicMetadataRow>
              )}
              {artist.website && (
                <PublicMetadataRow label={tCommonLabels('website')}>
                  <PublicMetadataLink href={artist.website} external>
                    {artist.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    <IconExternalLink size={12} style={{ marginLeft: 4 }} />
                  </PublicMetadataLink>
                </PublicMetadataRow>
              )}
              {hasSocialLinks && (
                <PublicMetadataRow label={tCommonLabels('social')} valueAlign="center">
                  <SocialLinksDisplay links={artist.socialLinks} iconSize={14} />
                </PublicMetadataRow>
              )}
              {artist.labels.length > 0 && (
                <PublicMetadataRow label={tCommonEntities('label')}>
                  <PublicMetadataValueGroup>
                    {artist.labels.map((label) => (
                      <PublicMetadataLink key={label.id} href={`/labels/${label.slug || label.id}`}>
                        {label.name}
                      </PublicMetadataLink>
                    ))}
                  </PublicMetadataValueGroup>
                </PublicMetadataRow>
              )}
            </PublicMetadataRows>
          </Stack>
        </Group>
        {artist.images.length > 1 ? (
          <Box>
            <Text className={classes.sectionHeader}>{t('sections.gallery')}</Text>
            <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="md">
              {artist.images
                .slice(1)
                .map((image) =>
                  image.url ? (
                    <img
                      key={image.fileId}
                      src={buildManagedImageUrl(image.url, MANAGED_IMAGE_PRESET.HEADER_IMAGE) ?? undefined}
                      alt={artist.name}
                      className={classes.galleryImage}
                    />
                  ) : null,
                )}
            </SimpleGrid>
          </Box>
        ) : null}
        {artist.content && artist.content.length > 0 && (
          <Box>
            <Text className={classes.sectionHeader}>{t('sections.biography')}</Text>
            <div className="prose">
              {artist.content.map((block) => (
                <GeneratedRichTextBlockView key={block.id} block={block} requestedLocale={contentLocale} />
              ))}
            </div>
          </Box>
        )}
        <Box>
          <Text className={classes.sectionHeader}>{tCommonEntities('releases')}</Text>
          {artist.releases.length > 0 ? (
            <ReleaseListViewClient
              releases={artist.releases.map((release) => ({
                id: release.id,
                href: `/releases/${release.slug || release.id}`,
                title: release.title,
                imageUrl: release.artworkUrl,
                imageAlt: release.title,
                releaseDate: release.releaseDate?.toISOString() ?? null,
                mainArtists: getReleaseArtists(release),
              }))}
              parsedProps={artistReleaseListProps}
            />
          ) : (
            <Text size="sm" c="dimmed" py="md">
              {t('releases.empty')}
            </Text>
          )}
        </Box>
        {artist.works.length > 0 && (
          <ArtistWorkSection
            works={artist.works.map((work) => ({
              id: work.id,
              title: work.title,
              slug: work.slug,
              type: work.type ?? 'music_project',
              featured_image_url: work.featuredImageUrl ?? null,
            }))}
          />
        )}
        {artist.tracks.length > 0 && (
          <Box>
            <Text className={classes.sectionHeader}>{t('sections.tracks', { count: artist.tracks.length })}</Text>
            <SectionCard p={0}>
              <Stack gap={0}>
                {artist.tracks.slice(0, 10).map((track, index) => (
                  <Group
                    key={track.id}
                    justify="space-between"
                    wrap="nowrap"
                    className={classes.trackRow}
                    data-first={index === 0 || undefined}
                  >
                    <Text size="sm" fw={500} lineClamp={1}>
                      {track.title}
                    </Text>
                    <LabelBadge size="xs" style={{ flexShrink: 0 }}>
                      {track.roleName}
                    </LabelBadge>
                  </Group>
                ))}
                {artist.tracks.length > 10 && (
                  <Text size="sm" c="dimmed" ta="center" py="sm">
                    {t('tracks.more', { count: artist.tracks.length - 10 })}
                  </Text>
                )}
              </Stack>
            </SectionCard>
          </Box>
        )}
      </Stack>
    </>
  );
}
