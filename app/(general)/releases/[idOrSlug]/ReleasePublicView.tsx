'use client';

import { SectionCard as DsSectionCard } from '@/components/core/Section/SectionCard';
import { MediaImage } from '@/components/core/MediaImage';
import {
  LayoutInset as DsLayoutInset,
  LayoutInline as DsLayoutInline,
  LayoutStack as DsLayoutStack,
} from '@/components/core/Layout';
import { Text as DsText, Heading as DsHeading } from '@/components/core/Typography';

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
import { GeneratedRichTextBlockView } from '@/features/page/PageView/blocks/GeneratedRichTextBlockView';
import { ReleaseCreditsList } from '@/features/release/ReleaseCreditsList';
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
const releaseArtistFallbackLabel = 'Unknown';

interface CreditGroup {
  id: string;
  name: string;
  entries: {
    id: string;
    name: string;
    href: string | null;
    imageUrl: string | null;
    note: string | null;
  }[];
}

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
  const tCommonStates = useTranslations('common.states');

  const releaseDate = formatReleaseDate(release.releaseDate, uiLocale);
  const hasLinks = streamingLinkEntries.length > 0;
  const pathname = `/releases/${release.slug || release.id}`;
  const releaseArtists = dedupeReleaseArtists(release.artists);
  const creditGroups = release.credits.reduce<CreditGroup[]>((groups, credit) => {
    const groupName = credit.creditRole?.trim() || tCommonEntities('credit');
    const entry = {
      id: credit.id,
      name: credit.name,
      href:
        credit.slug || credit.artistId
          ? `/artists/${credit.slug || credit.artistId}`
          : credit.memberId
            ? `/user/${credit.memberId}`
            : null,
      imageUrl: credit.imageUrl,
      note: credit.note,
    };
    const existing = groups.find((group) => group.name === groupName);
    if (existing) {
      existing.entries.push(entry);
      return groups;
    }
    return [...groups, { id: groupName, name: groupName, entries: [entry] }];
  }, []);

  return (
    <>
      {releaseMetadata && <JsonLdScript data={buildReleaseJsonLd(releaseMetadata)} />}
      <DsLayoutStack gap="xl">
        <DsLayoutInline
          direction={{ base: 'column', sm: 'row' }}
          gap={{ base: 'md', sm: 'xl' }}
          align="start"
          wrap="nowrap"
        >
          <div className={classes.artworkCard}>
            <div className={classes.artworkMedia}>
              {release.artworkUrl ? (
                <div className={classes.artworkImage}>
                  <MediaImage
                    src={buildManagedImageUrl(release.artworkUrl, MANAGED_IMAGE_PRESET.COVER_HERO)}
                    alt={release.title}
                    width="100%"
                    height="100%"
                    fit="cover"
                  />
                </div>
              ) : (
                <div className={classes.artworkPlaceholder}>
                  <DsSectionCard padding="none" border="none" appearance="muted" stretch />
                </div>
              )}
            </div>
          </div>

          <div className={classes.meta}>
            <DsLayoutStack gap="sm">
              <DsLayoutInline
                direction={{ base: 'column', sm: 'row' }}
                gap="md"
                justify="between"
                align="start"
                wrap="nowrap"
              >
                <div className={classes.metaMain}>
                  <DsLayoutStack gap="xs">
                    <DsHeading
                      level={1}
                      scale="title"
                      lang={
                        release.localizationInfo?.displayedLocale ||
                        release.localizationInfo?.sourceLocale ||
                        requestedLocale
                      }
                    >
                      {release.title}
                    </DsHeading>
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
                                  {label.catalogNumber ? `${label.name} (${label.catalogNumber})` : label.name}
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
                      {creditGroups.length > 0 && (
                        <PublicMetadataRow label={tCommonEntities('credits')}>
                          <div className={classes.detailCredits}>
                            <ReleaseCreditsList groups={creditGroups} unknownLabel={tCommonStates('unknown')} />
                          </div>
                        </PublicMetadataRow>
                      )}
                      {hasLinks && (
                        <PublicMetadataRow label={t('streaming')}>
                          <SocialLinksDisplayView entries={streamingLinkEntries} variant="button" />
                        </PublicMetadataRow>
                      )}
                    </PublicMetadataRows>
                  </DsLayoutStack>
                </div>
                <div className={classes.actions}>
                  <DsLayoutInline gap="sm" align="start" justify="end" wrap={{ base: 'wrap', sm: 'nowrap' }}>
                    <ContentLanguageMenu
                      pathname={pathname}
                      query={query}
                      requestedLocale={requestedLocale}
                      localizationInfo={release.localizationInfo}
                    />
                  </DsLayoutInline>
                </div>
              </DsLayoutInline>
            </DsLayoutStack>
          </div>
        </DsLayoutInline>

        {release.content && release.content.length > 0 ? (
          <DsLayoutStack gap="xxs">
            <DsText size="sm" font="mono" weight="medium" tone="muted" role="heading" aria-level={2}>
              {tCommonLabels('description')}
            </DsText>
            <div
              className="prose"
              lang={
                release.localizationInfo?.displayedLocale || release.localizationInfo?.sourceLocale || requestedLocale
              }
            >
              {/* The authored body sits under the level-2 section label: authored H1 → h3. */}
              <DocumentHeadingScope parentLevel={2}>
                {release.content.map((block) => (
                  <GeneratedRichTextBlockView key={block.id} block={block} requestedLocale={requestedLocale} />
                ))}
              </DocumentHeadingScope>
            </div>
          </DsLayoutStack>
        ) : release.descriptionText ? (
          <DsLayoutStack gap="xxs">
            <DsText size="sm" font="mono" weight="medium" tone="muted" role="heading" aria-level={2}>
              {tCommonLabels('description')}
            </DsText>
            <DsText
              wrap="preserve"
              lang={
                release.localizationInfo?.displayedLocale || release.localizationInfo?.sourceLocale || requestedLocale
              }
            >
              {release.descriptionText}
            </DsText>
          </DsLayoutStack>
        ) : null}

        {release.tracks.length > 0 && (
          <DsLayoutInset blockStart="xs">
            <DsLayoutStack gap="sm" role="group" aria-label={tCommonEntities('tracks')}>
              <DsText size="sm" font="mono" weight="medium" tone="muted" role="heading" aria-level={2}>
                {tCommonEntities('tracks')}
              </DsText>
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
                          <DsText size="sm" weight="medium" lines={1}>
                            {track.title}
                          </DsText>
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
          </DsLayoutInset>
        )}
      </DsLayoutStack>
    </>
  );
}

export type ReleasePublicViewProps = Parameters<typeof ReleasePublicView>[0];
