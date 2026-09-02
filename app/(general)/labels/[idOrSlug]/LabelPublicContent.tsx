import { IconExternalLink } from '@tabler/icons-react';
import { getTranslations } from 'next-intl/server';
import { Avatar, Box, Divider, Group, Stack, Text, Title } from '@mantine/core';
import { PublicMetadataLink, PublicMetadataRow, PublicMetadataRows } from '@/components/core/PublicMetadata';
import { JsonLdScript } from '@/features/metadata/ui/JsonLdScript';
import { parseArtistListProps } from '@/features/page/blocks/artist-grid/schema';
import { ArtistListViewClient } from '@/features/page/blocks/artist-grid/ViewClient';
import { parseReleaseListProps } from '@/features/page/blocks/releases-gallery/schema';
import { ReleaseListViewClient } from '@/features/page/blocks/releases-gallery/ViewClient';
import { ShareButton } from '@/features/share/ShareButton';
import { GeneratedRichTextBlockView } from '@/features/page/PageView/blocks/GeneratedRichTextBlockView';
import { SocialLinksDisplay } from '@/features/social-links/SocialLinksDisplay';
import { ThemedAssetImage } from '@/features/media/ThemedAssetImage';
import { ContentLanguageMenu } from '@/features/translation/ContentLanguageMenu';
import { LocalizationNotice } from '@/features/translation/LocalizationNotice';
import { formatCountryDisplayName } from '@/lib/countries';
import type { getLabelPublic } from '@/lib/queries/label';
import type { getLabelMetadataDocument } from '@/lib/queries/metadata';
import { buildLabelJsonLd } from '@/lib/utils/json-ld';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';
import type { SearchParamRecord } from '@/lib/utils/request-path';
import classes from './page.module.css';

const labelReleaseListProps = parseReleaseListProps({
  limit: '12',
  columns: '4',
  layout: 'grid',
  imageAspectRatio: '1:1',
});

const labelArtistListProps = parseArtistListProps({
  limit: '12',
  columns: '6',
  layout: 'grid',
  imageAspectRatio: '1:1',
  showMeta: 'false',
});

type LabelView = NonNullable<Awaited<ReturnType<typeof getLabelPublic>>>;
type LabelMetadata = NonNullable<Awaited<ReturnType<typeof getLabelMetadataDocument>>>;

function getLabelReleaseArtists(release: { artists: { id: string; name: string; slug: string | null }[] }) {
  const seenArtists = new Set<string>();
  return release.artists.flatMap((artist) => {
    const key = artist.id || artist.slug || artist.name;
    if (!key || seenArtists.has(key)) {
      return [];
    }
    seenArtists.add(key);
    return [{ id: key, label: artist.name, href: `/artists/${artist.slug || artist.id}` }];
  });
}

function getUniqueLabelArtists(artists: LabelView['artists']) {
  const seenArtists = new Set<string>();
  return artists.filter((artist) => {
    const key = artist.id || artist.slug || artist.name;
    if (!key || seenArtists.has(key)) {
      return false;
    }
    seenArtists.add(key);
    return true;
  });
}

export async function LabelPublicContent({
  label,
  labelMetadata,
  baseUrl,
  query,
  requestedLocale,
  uiLocale,
}: {
  label: LabelView;
  labelMetadata: LabelMetadata | null;
  baseUrl: string;
  query: SearchParamRecord;
  requestedLocale: string | null;
  uiLocale: string;
}) {
  const [t, tCommonLabels] = await Promise.all([getTranslations('labelPage'), getTranslations('common.labels')]);
  const url = `${baseUrl}/labels/${label.slug || label.id}`;
  const shareToken = Array.isArray(query.share) ? query.share[0] : query.share;
  const shareUrl = shareToken ? `${baseUrl}/s/${encodeURIComponent(shareToken)}` : url;
  const pathname = `/labels/${label.slug || label.id}`;
  const contentLocale = requestedLocale ?? uiLocale;
  const hasSocialLinks = label.socialLinks && Object.keys(label.socialLinks).length > 0;
  const labelArtists = getUniqueLabelArtists(label.artists);
  const imageUrl = label.imageUrl && buildManagedImageUrl(label.imageUrl, MANAGED_IMAGE_PRESET.HEADER_IMAGE);
  const imageLightUrl =
    label.imageLightUrl && buildManagedImageUrl(label.imageLightUrl, MANAGED_IMAGE_PRESET.HEADER_IMAGE);
  const imageDarkUrl =
    label.imageDarkUrl && buildManagedImageUrl(label.imageDarkUrl, MANAGED_IMAGE_PRESET.HEADER_IMAGE);

  return (
    <>
      {labelMetadata ? <JsonLdScript data={buildLabelJsonLd(labelMetadata)} /> : null}
      <Stack gap="xl">
        <LocalizationNotice
          pathname={pathname}
          query={query}
          requestedLocale={contentLocale}
          localizationInfo={label.localizationInfo}
          variant="subtle"
        />
        <Group align="flex-start" gap="xl" wrap="wrap" className={classes.header}>
          {label.imageUrl || label.imageLightUrl || label.imageDarkUrl ? (
            <Box className={classes.imageContainer}>
              <ThemedAssetImage
                fallbackUrl={imageUrl}
                lightUrl={imageLightUrl}
                darkUrl={imageDarkUrl}
                alt={label.name}
                className={classes.image}
              />
            </Box>
          ) : null}
          <Stack gap="md" className={classes.infoContainer}>
            <Group className={classes.titleRow} justify="space-between" align="flex-start">
              <Box className={classes.titleBlock}>
                <Title order={1}>{label.name}</Title>
                {label.descriptionText ? (
                  <Text c="dimmed" mt="xs">
                    {label.descriptionText}
                  </Text>
                ) : null}
              </Box>
              <Group className={classes.headerActions} gap="xs" align="center" wrap="nowrap">
                <ContentLanguageMenu
                  pathname={pathname}
                  query={query}
                  requestedLocale={contentLocale}
                  localizationInfo={label.localizationInfo}
                />
                <ShareButton url={shareUrl} title={label.name} />
              </Group>
            </Group>
            <Divider />
            <PublicMetadataRows>
              {label.countryCode ? (
                <PublicMetadataRow label={tCommonLabels('country')}>
                  <Text size="sm">{formatCountryDisplayName(label.countryCode, uiLocale)}</Text>
                </PublicMetadataRow>
              ) : null}
              {label.website ? (
                <PublicMetadataRow label={tCommonLabels('website')}>
                  <PublicMetadataLink href={label.website} external>
                    {label.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    <IconExternalLink size={12} style={{ marginLeft: 4 }} />
                  </PublicMetadataLink>
                </PublicMetadataRow>
              ) : null}
              {hasSocialLinks ? (
                <PublicMetadataRow label={tCommonLabels('social')} valueAlign="center">
                  <SocialLinksDisplay links={label.socialLinks} iconSize={14} />
                </PublicMetadataRow>
              ) : null}
              {label.parentLabel ? (
                <PublicMetadataRow label={t('details.parent')}>
                  <PublicMetadataLink href={`/labels/${label.parentLabel.slug || label.parentLabel.id}`}>
                    <Group gap="xs">
                      {label.parentLabel.imageUrl ? (
                        <Avatar
                          src={buildManagedImageUrl(label.parentLabel.imageUrl, MANAGED_IMAGE_PRESET.AVATAR_XS)}
                          size="xs"
                          radius={0}
                        />
                      ) : null}
                      <Text size="sm" c="inherit">
                        {label.parentLabel.name}
                      </Text>
                    </Group>
                  </PublicMetadataLink>
                </PublicMetadataRow>
              ) : null}
              <PublicMetadataRow label={t('details.stats')}>
                <Text size="sm">
                  {t('details.statsValue', { releases: label.releaseCount, artists: label.artistCount })}
                </Text>
              </PublicMetadataRow>
            </PublicMetadataRows>
          </Stack>
        </Group>

        {label.content && label.content.length > 0 ? (
          <Box>
            <Text className={classes.sectionHeader}>{tCommonLabels('description')}</Text>
            <div className="prose">
              {label.content.map((block) => (
                <GeneratedRichTextBlockView key={block.id} block={block} requestedLocale={contentLocale} />
              ))}
            </div>
          </Box>
        ) : null}

        {label.releases.length > 0 ? (
          <Box>
            <Text className={classes.sectionHeader}>{t('sections.releases', { count: label.releaseCount })}</Text>
            <ReleaseListViewClient
              releases={label.releases.slice(0, 12).map((release) => ({
                id: release.id,
                href: `/releases/${release.slug || release.id}`,
                title: release.title,
                imageUrl: release.artworkUrl,
                imageAlt: release.title,
                releaseDate: release.releaseDate?.toISOString() ?? null,
                mainArtists: getLabelReleaseArtists(release),
              }))}
              parsedProps={labelReleaseListProps}
            />
            {label.releaseCount > 12 ? (
              <Text size="sm" c="dimmed" ta="center" mt="md">
                {t('lists.showingReleases', { shown: 12, total: label.releaseCount })}
              </Text>
            ) : null}
          </Box>
        ) : null}

        {labelArtists.length > 0 ? (
          <Box>
            <Text className={classes.sectionHeader}>{t('sections.artists', { count: label.artistCount })}</Text>
            <ArtistListViewClient
              artists={labelArtists.slice(0, 12).map((artist) => ({
                id: artist.id,
                href: `/artists/${artist.slug || artist.id}`,
                title: artist.name,
                imageUrl: artist.imageUrl,
                imageAlt: artist.name,
                socialLinks: null,
              }))}
              parsedProps={labelArtistListProps}
            />
            {label.artistCount > 12 ? (
              <Text size="sm" c="dimmed" ta="center" mt="md">
                {t('lists.showingArtists', { shown: 12, total: label.artistCount })}
              </Text>
            ) : null}
          </Box>
        ) : null}
      </Stack>
    </>
  );
}
