'use client';

import { SectionCard as DsSectionCard } from '@/components/core/Section/SectionCard';
import {
  LayoutInset as DsLayoutInset,
  LayoutInline as DsLayoutInline,
  LayoutStack as DsLayoutStack,
} from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import {
  PublicMetadataLink,
  PublicMetadataRow,
  PublicMetadataRows,
  PublicMetadataValueGroup,
} from '@/components/core/PublicMetadata';
import { JsonLdScript } from '@/features/metadata/ui/JsonLdScript';
import { DocumentHeadingScope } from '@/features/document-layout/ui/DocumentHeadingScope';
import {
  EntityDetailImage,
  EntityDetailLayout,
  EntityDetailSection,
} from '@/features/document-layout/ui/EntityDetailLayout';
import { GeneratedRichTextBlockView } from '@/features/page/PageView/blocks/GeneratedRichTextBlockView';
import { hasPublicCredits, PublicCreditList } from '@/features/credits/PublicCreditList';
import {
  SocialLinksDisplayView,
  type SocialLinkDisplayViewModel,
} from '@/features/social-links/ui/SocialLinksDisplayView';
import { ContentLanguageMenu } from '@/features/translation/ContentLanguageMenu';
import type { getReleaseMetadataDocument } from '@/lib/queries/metadata';
import type { PublicRelease } from '@/lib/queries/release';
import { formatDateTimeInZone } from '@/components/core/DateTime';
import { buildReleaseJsonLd } from '@/lib/utils/json-ld';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';
import { ReleaseTrackAudioPlayer } from './ReleaseTrackAudioPlayer';
import classes from './page.module.css';

const releaseDateFallbackLabel = 'TBA';

/** Track position in the listing: "01", or "2-01" when the release spans several discs. */
function formatTrackPosition(track: { trackNumber: number; discNumber: number | null }, multipleDiscs: boolean) {
  const number = String(track.trackNumber).padStart(2, '0');
  return multipleDiscs ? `${track.discNumber ?? 1}-${number}` : number;
}
const releaseArtistFallbackLabel = 'Unknown';

function dedupeReleaseArtists<T extends { id: string; role?: string | null }>(artists: T[]): T[] {
  const seen = new Set<string>();
  return artists.filter((artist) => {
    const key = `${artist.id}:${artist.role ?? ''}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function formatDuration(durationMs: number | null): string {
  if (!durationMs || durationMs <= 0) {
    return '-';
  }
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatReleaseDate(date: Date | null, locale: string): string {
  if (!date) {
    return releaseDateFallbackLabel;
  }
  return formatDateTimeInZone(date, locale, 'UTC', 'date', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

interface ReleaseTypeLabels {
  album: string;
  ep: string;
  single: string;
  compilation: string;
  release: string;
}

function getReleaseTypeLabel(type: string | null | undefined, labels: ReleaseTypeLabels): string {
  switch (type?.toLowerCase()) {
    case 'album':
      return labels.album;
    case 'ep':
      return labels.ep;
    case 'single':
      return labels.single;
    case 'compilation':
      return labels.compilation;
    default:
      return type?.toUpperCase() || labels.release;
  }
}

function joinInlineValues(values: ReactNode[], separator = ' / '): ReactNode[] {
  const filtered = values.filter(Boolean);
  return filtered.flatMap((value, index) =>
    index === 0
      ? [value]
      : [
          <DsText key={`separator-${index}`} size="sm" as="span" tone="secondary">
            {separator}
          </DsText>,
          value,
        ],
  );
}

export function ReleasePublicView({
  release,
  releaseMetadata,
  query,
  requestedLocale,
  uiLocale,
  shareToken,
  sharePassword,
  streamingLinkEntries,
}: {
  release: PublicRelease;
  releaseMetadata: Awaited<ReturnType<typeof getReleaseMetadataDocument>> | null;
  query: Record<string, string | string[] | undefined>;
  requestedLocale: string;
  uiLocale: string;
  shareToken?: string;
  sharePassword?: string;
  /** Release streaming URLs prepared on the server by `prepareReleaseStreamingLinks`. */
  streamingLinkEntries: SocialLinkDisplayViewModel[];
}) {
  const t = useTranslations('releasePage');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonLabels = useTranslations('common.labels');

  const releaseDate = formatReleaseDate(release.releaseDate, uiLocale);
  const hasLinks = streamingLinkEntries.length > 0;
  const pathname = `/releases/${release.slug || release.id}`;
  const releaseArtists = dedupeReleaseArtists(release.artists);
  const creditGroups = [
    {
      id: 'credits',
      entries: release.credits.map((credit) => ({
        id: credit.id,
        name: credit.name,
        role: credit.creditRole,
        note: credit.note,
        href:
          credit.slug || credit.artistId
            ? `/artists/${credit.slug || credit.artistId}`
            : credit.memberId
              ? `/user/${credit.memberId}`
              : null,
      })),
    },
  ];

  const hasMultipleDiscs = new Set(release.tracks.map((track) => track.discNumber ?? 1)).size > 1;

  const contentLang =
    release.localizationInfo?.displayedLocale || release.localizationInfo?.sourceLocale || requestedLocale;

  const body =
    release.content && release.content.length > 0 ? (
      <div className="prose" lang={contentLang}>
        <DocumentHeadingScope parentLevel={1}>
          {release.content.map((block) => (
            <GeneratedRichTextBlockView key={block.id} block={block} requestedLocale={requestedLocale} />
          ))}
        </DocumentHeadingScope>
      </div>
    ) : release.descriptionText ? (
      <DsText wrap="preserve" lang={contentLang}>
        {release.descriptionText}
      </DsText>
    ) : null;

  return (
    <>
      {releaseMetadata && <JsonLdScript data={buildReleaseJsonLd(releaseMetadata)} />}
      <EntityDetailLayout
        body={body}
        media={
          release.artworkUrl ? (
            <EntityDetailImage
              src={buildManagedImageUrl(release.artworkUrl, MANAGED_IMAGE_PRESET.COVER_HERO) ?? release.artworkUrl}
              alt={release.title}
              fit="cover"
            />
          ) : (
            <div className={classes.artworkPlaceholder}>
              <DsSectionCard padding="none" border="none" appearance="muted" stretch />
            </div>
          )
        }
        title={release.title}
        titleLang={contentLang}
        actions={
          <ContentLanguageMenu
            pathname={pathname}
            query={query}
            requestedLocale={requestedLocale}
            localizationInfo={release.localizationInfo}
          />
        }
        listing={
          release.tracks.length > 0 ? (
            <EntityDetailSection title={tCommonEntities('tracks')}>
              <DsLayoutStack gap="none">
                {release.tracks.map((track, index) => (
                  <DsSectionCard
                    key={track.id}
                    role="group"
                    aria-label={track.title}
                    padding="none"
                    appearance="plain"
                    border={index === 0 ? 'none' : 'block-start'}
                  >
                    <DsLayoutInset block="sm">
                      <DsLayoutStack gap="xs">
                        <div className={classes.trackMeta}>
                          <DsLayoutInline justify="between" wrap="nowrap" gap="md">
                            <DsLayoutInline wrap="nowrap" gap="sm" align="baseline">
                              <DsText size="sm" tone="secondary" font="mono" numeric="tabular">
                                {formatTrackPosition(track, hasMultipleDiscs)}
                              </DsText>
                              <DsText size="sm" weight="medium" lines={1}>
                                {track.title}
                              </DsText>
                            </DsLayoutInline>
                            <DsText tone="secondary" size="xs">
                              {formatDuration(track.durationMs)}
                            </DsText>
                          </DsLayoutInline>
                        </div>
                        <ReleaseTrackAudioPlayer
                          releaseId={release.id}
                          trackId={track.id}
                          title={track.title}
                          fileId={track.fileId}
                          fileName={track.fileName}
                          durationSeconds={track.durationMs ? Math.floor(track.durationMs / 1000) : 0}
                          hlsUrl={track.hlsUrl}
                          waveform={track.waveformData}
                          spectrogramUrl={track.spectrogramUrl}
                          downloadAvailability={track.downloadAvailability}
                          downloadAction={track.downloadAction}
                          downloadUrl={track.downloadUrl}
                          downloadExpiresAt={track.downloadExpiresAt}
                          requestedLocale={requestedLocale}
                          shareToken={shareToken}
                          sharePassword={sharePassword}
                        />
                      </DsLayoutStack>
                    </DsLayoutInset>
                  </DsSectionCard>
                ))}
              </DsLayoutStack>
            </EntityDetailSection>
          ) : undefined
        }
        meta={
          <PublicMetadataRows>
            <PublicMetadataRow
              label={releaseArtists.length === 1 ? tCommonEntities('artist') : tCommonEntities('artists')}
            >
              <PublicMetadataValueGroup>
                {releaseArtists.length > 0 ? (
                  joinInlineValues(
                    releaseArtists.map((artist) => (
                      <PublicMetadataLink
                        key={`${artist.id}-${artist.role ?? ''}`}
                        href={`/artists/${artist.slug || artist.id}`}
                      >
                        {artist.name}
                      </PublicMetadataLink>
                    )),
                  )
                ) : (
                  <DsText size="sm" as="span">
                    {releaseArtistFallbackLabel}
                  </DsText>
                )}
              </PublicMetadataValueGroup>
            </PublicMetadataRow>
            <PublicMetadataRow label={tCommonLabels('type')}>
              <DsText size="sm" as="span">
                {getReleaseTypeLabel(release.type, {
                  album: t('types.album'),
                  ep: t('types.ep'),
                  single: t('types.single'),
                  compilation: t('types.compilation'),
                  release: tCommonEntities('release'),
                })}
              </DsText>
            </PublicMetadataRow>
            <PublicMetadataRow label={tCommonLabels('releaseDate')}>
              <DsText size="sm" as="span">
                {releaseDate}
              </DsText>
            </PublicMetadataRow>
            {release.labels.length > 0 && (
              <PublicMetadataRow
                label={release.labels.length > 1 ? tCommonEntities('labels') : tCommonEntities('label')}
              >
                <PublicMetadataValueGroup>
                  {joinInlineValues(
                    release.labels.map((label) => (
                      <PublicMetadataLink key={label.id} href={`/labels/${label.slug || label.id}`}>
                        {/* A label's own number only when it differs from the release's catalog number row. */}
                        {label.catalogNumber && label.catalogNumber !== release.catalogNumber
                          ? `${label.name} (${label.catalogNumber})`
                          : label.name}
                      </PublicMetadataLink>
                    )),
                  )}
                </PublicMetadataValueGroup>
              </PublicMetadataRow>
            )}
            {release.catalogNumber && (
              <PublicMetadataRow label={tCommonLabels('catalogNumber')}>
                <DsText size="sm" as="span">
                  {release.catalogNumber}
                </DsText>
              </PublicMetadataRow>
            )}
            {release.formats.length > 0 && (
              <PublicMetadataRow
                label={release.formats.length > 1 ? tCommonEntities('formats') : tCommonEntities('format')}
              >
                <PublicMetadataValueGroup>
                  {joinInlineValues(
                    release.formats.map((format) => (
                      <DsText key={format.id} size="sm" as="span">
                        {format.description ? `${format.name} (${format.description})` : format.name}
                      </DsText>
                    )),
                  )}
                </PublicMetadataValueGroup>
              </PublicMetadataRow>
            )}
            {release.genres.length > 0 && (
              <PublicMetadataRow
                label={release.genres.length > 1 ? tCommonEntities('genres') : tCommonEntities('genre')}
              >
                <PublicMetadataValueGroup>
                  {joinInlineValues(
                    release.genres.map((genre) => (
                      <DsText key={genre.id} size="sm" as="span">
                        {genre.name}
                      </DsText>
                    )),
                  )}
                </PublicMetadataValueGroup>
              </PublicMetadataRow>
            )}
            {release.styles.length > 0 && (
              <PublicMetadataRow
                label={release.styles.length > 1 ? tCommonEntities('styles') : tCommonEntities('style')}
              >
                <PublicMetadataValueGroup>
                  {joinInlineValues(
                    release.styles.map((style) => (
                      <DsText key={style.id} size="sm" as="span">
                        {style.name}
                      </DsText>
                    )),
                  )}
                </PublicMetadataValueGroup>
              </PublicMetadataRow>
            )}
            {hasPublicCredits(creditGroups) && (
              <PublicMetadataRow label={tCommonEntities('credits')}>
                <PublicCreditList groups={creditGroups} label={tCommonEntities('credits')} />
              </PublicMetadataRow>
            )}
            {hasLinks && (
              <PublicMetadataRow label={t('streaming')}>
                <SocialLinksDisplayView entries={streamingLinkEntries} variant="button" />
              </PublicMetadataRow>
            )}
          </PublicMetadataRows>
        }
      />
    </>
  );
}

export type ReleasePublicViewProps = Parameters<typeof ReleasePublicView>[0];
