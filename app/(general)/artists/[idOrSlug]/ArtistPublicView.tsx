'use client';
import { SupportingText, Text as DsText } from '@/components/core/Typography';

import {
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutGrid as DsLayoutGrid,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';

import { useTranslations } from 'next-intl';

import { LabelBadge } from '@/components/core/Badge';
import {
  PublicMetadataLink,
  PublicMetadataRow,
  PublicMetadataRows,
  PublicMetadataValueGroup,
} from '@/components/core/PublicMetadata';
import { SectionCard } from '@/components/core/Section';
import { JsonLdScript } from '@/features/metadata/ui/JsonLdScript';
import type { ReleaseListProps } from '@/features/page/blocks/releases-gallery/schema';
import { ReleaseListViewClient } from '@/features/page/blocks/releases-gallery/ViewClient';
import { DocumentHeadingScope } from '@/features/document-layout/ui/DocumentHeadingScope';
import { GeneratedRichTextBlockView } from '@/features/page/PageView/blocks/GeneratedRichTextBlockView';
import {
  SocialLinksDisplayView,
  type SocialLinkDisplayViewModel,
} from '@/features/social-links/ui/SocialLinksDisplayView';
import { ContentLanguageMenu } from '@/features/translation/ContentLanguageMenu';
import type { getArtistView } from '@/lib/queries/artist';
import type { getArtistMetadataDocument } from '@/lib/queries/metadata';
import { buildArtistJsonLd } from '@/lib/utils/json-ld';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';
import type { SearchParamRecord } from '@/lib/utils/request-path';
import { ArtistWorkSection } from './ArtistWorkSection';
import {
  EntityDetailImage,
  EntityDetailLayout,
  EntityDetailSection,
} from '@/features/document-layout/ui/EntityDetailLayout';
import classes from './page.module.css';

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

export function ArtistPublicView({
  artist,
  artistMetadata,
  query,
  requestedLocale,
  uiLocale,
  socialLinkEntries,
  releaseListProps,
  countryName,
}: {
  artist: ArtistView;
  artistMetadata: ArtistMetadata | null;
  query: SearchParamRecord;
  requestedLocale: string | null;
  uiLocale: string;
  /** `artist.socialLinks` prepared on the server by `prepareSocialLinksDisplay`. */
  socialLinkEntries: SocialLinkDisplayViewModel[];
  /** Prepared on the server by `prepareArtistPublicView`, so the client does not ship zod or the country catalogue. */
  releaseListProps: ReleaseListProps;
  countryName: string;
}) {
  const t = useTranslations('artistPage');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonLabels = useTranslations('common.labels');

  const pathname = `/artists/${artist.slug || artist.id}`;
  const contentLocale = requestedLocale ?? uiLocale;
  const hasSocialLinks = artist.socialLinks && Object.keys(artist.socialLinks).length > 0;
  const getReleaseArtists = getArtistReleaseArtists(artist);

  const contentLang =
    artist.localizationInfo?.displayedLocale || artist.localizationInfo?.sourceLocale || contentLocale;

  return (
    <>
      {artistMetadata && <JsonLdScript data={buildArtistJsonLd(artistMetadata)} />}
      <EntityDetailLayout
        media={
          artist.imageUrl ? (
            <EntityDetailImage
              src={buildManagedImageUrl(artist.imageUrl, MANAGED_IMAGE_PRESET.HEADER_IMAGE) ?? artist.imageUrl}
              alt={artist.name}
            />
          ) : undefined
        }
        title={artist.name}
        titleLang={contentLang}
        actions={
          <ContentLanguageMenu
            pathname={pathname}
            query={query}
            requestedLocale={contentLocale}
            localizationInfo={artist.localizationInfo}
          />
        }
        meta={
          <PublicMetadataRows>
            {artist.isGroup && (
              <PublicMetadataRow label={tCommonLabels('type')}>
                <DsText size="sm" as="span">
                  {t('labels.group')}
                </DsText>
              </PublicMetadataRow>
            )}
            {artist.realName && (
              <PublicMetadataRow label={t('details.realName')}>
                <DsText size="sm">{artist.realName}</DsText>
              </PublicMetadataRow>
            )}
            {artist.countryCode && (
              <PublicMetadataRow label={tCommonLabels('country')}>
                <DsText size="sm">{countryName}</DsText>
              </PublicMetadataRow>
            )}
            {artist.website && (
              <PublicMetadataRow label={tCommonLabels('website')}>
                <PublicMetadataLink href={artist.website} external indicator="external">
                  {artist.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </PublicMetadataLink>
              </PublicMetadataRow>
            )}
            {hasSocialLinks && (
              <PublicMetadataRow label={tCommonLabels('social')} valueAlign="center">
                <SocialLinksDisplayView entries={socialLinkEntries} iconSize="sm" />
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
        }
      >
        {artist.images.length > 1 ? (
          <EntityDetailSection title={t('sections.gallery')}>
            <DsLayoutGrid columns={{ base: 2, sm: 3, md: 4 }} gap="md">
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
            </DsLayoutGrid>
          </EntityDetailSection>
        ) : null}
        {artist.content && artist.content.length > 0 && (
          <EntityDetailSection title={t('sections.biography')}>
            <div
              className="prose"
              lang={artist.localizationInfo?.displayedLocale || artist.localizationInfo?.sourceLocale || contentLocale}
            >
              {/* The authored body sits under the level-2 section label: authored H1 → h3. */}
              <DocumentHeadingScope parentLevel={2}>
                {artist.content.map((block) => (
                  <GeneratedRichTextBlockView key={block.id} block={block} requestedLocale={contentLocale} />
                ))}
              </DocumentHeadingScope>
            </div>
          </EntityDetailSection>
        )}
        <EntityDetailSection title={tCommonEntities('releases')}>
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
              parsedProps={releaseListProps}
            />
          ) : (
            <DsLayoutInset block="md">
              <SupportingText tone="secondary">{t('releases.empty')}</SupportingText>
            </DsLayoutInset>
          )}
        </EntityDetailSection>
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
          <EntityDetailSection title={t('sections.tracks', { count: artist.tracks.length })}>
            <DsLayoutStack gap="none">
              {artist.tracks.slice(0, 10).map((track, index) => (
                <SectionCard
                  key={track.id}
                  padding="none"
                  appearance="plain"
                  border={index === 0 ? 'none' : 'block-start'}
                >
                  <DsLayoutInset block="sm">
                    <DsLayoutInline justify="between" wrap="nowrap" data-first={index === 0 || undefined}>
                      <DsText size="sm" weight="medium" lines={1}>
                        {track.title}
                      </DsText>
                      <LabelBadge>{track.roleName}</LabelBadge>
                    </DsLayoutInline>
                  </DsLayoutInset>
                </SectionCard>
              ))}
              {artist.tracks.length > 10 && (
                <DsLayoutInset block="sm">
                  <DsText size="sm" tone="secondary" align="center">
                    {t('tracks.more', { count: artist.tracks.length - 10 })}
                  </DsText>
                </DsLayoutInset>
              )}
            </DsLayoutStack>
          </EntityDetailSection>
        )}
      </EntityDetailLayout>
    </>
  );
}

export type ArtistPublicViewProps = Parameters<typeof ArtistPublicView>[0];
