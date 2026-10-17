'use client';

import { LayoutInline as DsLayoutInline, LayoutInset as DsLayoutInset } from '@/components/core/Layout';

import { Text as DsText } from '@/components/core/Typography';
import { EntityDetailLayout, EntityDetailSection } from '@/features/document-layout/ui/EntityDetailLayout';
import { useTranslations } from 'next-intl';

import { Avatar } from '@/components/core/Display';
import { PublicMetadataLink, PublicMetadataRow, PublicMetadataRows } from '@/components/core/PublicMetadata';
import { JsonLdScript } from '@/features/metadata/ui/JsonLdScript';
import type { ArtistListProps } from '@/features/page/blocks/artist-grid/schema';
import { ArtistListViewClient } from '@/features/page/blocks/artist-grid/ViewClient';
import type { ReleaseListProps } from '@/features/page/blocks/releases-gallery/schema';
import { ReleaseListViewClient } from '@/features/page/blocks/releases-gallery/ViewClient';
import { DocumentHeadingScope } from '@/features/document-layout/ui/DocumentHeadingScope';
import { GeneratedRichTextBlockView } from '@/features/page/PageView/blocks/GeneratedRichTextBlockView';
import {
  SocialLinksDisplayView,
  type SocialLinkDisplayViewModel,
} from '@/features/social-links/ui/SocialLinksDisplayView';
import { ThemedAssetImage } from '@/features/media/ThemedAssetImage';
import { ContentLanguageMenu } from '@/features/translation/ContentLanguageMenu';
import type { getLabelPublic } from '@/lib/queries/label';
import type { getLabelMetadataDocument } from '@/lib/queries/metadata';
import { buildLabelJsonLd } from '@/lib/utils/json-ld';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';
import type { SearchParamRecord } from '@/lib/utils/request-path';
import classes from './page.module.css';

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

export function LabelPublicView({
  label,
  labelMetadata,
  query,
  requestedLocale,
  uiLocale,
  socialLinkEntries,
  releaseListProps,
  artistListProps,
  countryName,
}: {
  label: LabelView;
  labelMetadata: LabelMetadata | null;
  query: SearchParamRecord;
  requestedLocale: string | null;
  uiLocale: string;
  /** `label.socialLinks` prepared on the server by `prepareSocialLinksDisplay`. */
  socialLinkEntries: SocialLinkDisplayViewModel[];
  /** Prepared on the server by `prepareLabelPublicView`, so the client does not ship zod or the country catalogue. */
  releaseListProps: ReleaseListProps;
  artistListProps: ArtistListProps;
  countryName: string;
}) {
  const t = useTranslations('labelPage');
  const tCommonLabels = useTranslations('common.labels');

  const pathname = `/labels/${label.slug || label.id}`;
  const contentLocale = requestedLocale ?? uiLocale;
  const hasSocialLinks = label.socialLinks && Object.keys(label.socialLinks).length > 0;
  const labelArtists = getUniqueLabelArtists(label.artists);
  const imageUrl = label.imageUrl && buildManagedImageUrl(label.imageUrl, MANAGED_IMAGE_PRESET.HEADER_IMAGE);
  const imageLightUrl =
    label.imageLightUrl && buildManagedImageUrl(label.imageLightUrl, MANAGED_IMAGE_PRESET.HEADER_IMAGE);
  const imageDarkUrl =
    label.imageDarkUrl && buildManagedImageUrl(label.imageDarkUrl, MANAGED_IMAGE_PRESET.HEADER_IMAGE);

  const contentLang = label.localizationInfo?.displayedLocale || label.localizationInfo?.sourceLocale || contentLocale;

  return (
    <>
      {labelMetadata ? <JsonLdScript data={buildLabelJsonLd(labelMetadata)} /> : null}
      <EntityDetailLayout
        media={
          label.imageUrl || label.imageLightUrl || label.imageDarkUrl ? (
            <ThemedAssetImage
              fallbackUrl={imageUrl}
              lightUrl={imageLightUrl}
              darkUrl={imageDarkUrl}
              alt={label.name}
              className={classes.logo}
            />
          ) : undefined
        }
        title={label.name}
        titleLang={contentLang}
        actions={
          <ContentLanguageMenu
            pathname={pathname}
            query={query}
            requestedLocale={contentLocale}
            localizationInfo={label.localizationInfo}
          />
        }
        meta={
          <PublicMetadataRows>
            {label.countryCode ? (
              <PublicMetadataRow label={tCommonLabels('country')}>
                <DsText size="sm">{countryName}</DsText>
              </PublicMetadataRow>
            ) : null}
            {label.website ? (
              <PublicMetadataRow label={tCommonLabels('website')}>
                <PublicMetadataLink href={label.website} external indicator="external">
                  {label.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </PublicMetadataLink>
              </PublicMetadataRow>
            ) : null}
            {hasSocialLinks ? (
              <PublicMetadataRow label={tCommonLabels('social')} valueAlign="center">
                <SocialLinksDisplayView entries={socialLinkEntries} iconSize="sm" />
              </PublicMetadataRow>
            ) : null}
            {label.parentLabel ? (
              <PublicMetadataRow label={t('details.parent')}>
                <PublicMetadataLink href={`/labels/${label.parentLabel.slug || label.parentLabel.id}`}>
                  <DsLayoutInline gap="xs">
                    {label.parentLabel.imageUrl ? (
                      <Avatar
                        src={buildManagedImageUrl(label.parentLabel.imageUrl, MANAGED_IMAGE_PRESET.AVATAR_XS)}
                        size="xs"
                        shape="circle"
                      />
                    ) : null}
                    <DsText size="sm" tone="inherit">
                      {label.parentLabel.name}
                    </DsText>
                  </DsLayoutInline>
                </PublicMetadataLink>
              </PublicMetadataRow>
            ) : null}
            <PublicMetadataRow label={t('details.stats')}>
              <DsText size="sm">
                {t('details.statsValue', { releases: label.releaseCount, artists: label.artistCount })}
              </DsText>
            </PublicMetadataRow>
          </PublicMetadataRows>
        }
      >
        {label.content && label.content.length > 0 ? (
          <EntityDetailSection title={tCommonLabels('description')}>
            <div
              className="prose"
              lang={label.localizationInfo?.displayedLocale || label.localizationInfo?.sourceLocale || contentLocale}
            >
              {/* The authored body sits under the level-2 section label: authored H1 → h3. */}
              <DocumentHeadingScope parentLevel={2}>
                {label.content.map((block) => (
                  <GeneratedRichTextBlockView key={block.id} block={block} requestedLocale={contentLocale} />
                ))}
              </DocumentHeadingScope>
            </div>
          </EntityDetailSection>
        ) : null}

        {label.releases.length > 0 ? (
          <EntityDetailSection title={t('sections.releases', { count: label.releaseCount })}>
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
              parsedProps={releaseListProps}
            />
            {label.releaseCount > 12 ? (
              <DsLayoutInset blockStart="md">
                <DsText size="sm" tone="secondary" align="center">
                  {t('lists.showingReleases', { shown: 12, total: label.releaseCount })}
                </DsText>
              </DsLayoutInset>
            ) : null}
          </EntityDetailSection>
        ) : null}

        {labelArtists.length > 0 ? (
          <EntityDetailSection title={t('sections.artists', { count: label.artistCount })}>
            <ArtistListViewClient
              artists={labelArtists.slice(0, 12).map((artist) => ({
                id: artist.id,
                href: `/artists/${artist.slug || artist.id}`,
                title: artist.name,
                imageUrl: artist.imageUrl,
                imageAlt: artist.name,
                socialLinkEntries: [],
              }))}
              parsedProps={artistListProps}
            />
            {label.artistCount > 12 ? (
              <DsLayoutInset blockStart="md">
                <DsText size="sm" tone="secondary" align="center">
                  {t('lists.showingArtists', { shown: 12, total: label.artistCount })}
                </DsText>
              </DsLayoutInset>
            ) : null}
          </EntityDetailSection>
        ) : null}
      </EntityDetailLayout>
    </>
  );
}

export type LabelPublicViewProps = Parameters<typeof LabelPublicView>[0];
