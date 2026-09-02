import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Box, Group, Image, Stack, Text, Title } from '@mantine/core';
import {
  PublicMetadataLink,
  PublicMetadataRow,
  PublicMetadataRows,
  PublicMetadataValueGroup,
} from '@/components/core/PublicMetadata';
import { JsonLdScript } from '@/features/metadata/ui/JsonLdScript';
import { GeneratedRichTextBlockView } from '@/features/page/PageView/blocks/GeneratedRichTextBlockView';
import { ReleaseCreditsList } from '@/features/release/ReleaseCreditsList';
import { ShareButton } from '@/features/share/ShareButton';
import { SocialLinksDisplay } from '@/features/social-links/SocialLinksDisplay';
import { ContentLanguageMenu } from '@/features/translation/ContentLanguageMenu';
import { LocalizationNotice } from '@/features/translation/LocalizationNotice';
import type { getReleaseMetadataDocument } from '@/lib/queries/metadata';
import type { PublicRelease } from '@/lib/queries/release';
import { formatDateTimeInZone } from '@/components/core/DateTime';
import { buildReleaseJsonLd } from '@/lib/utils/json-ld';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';
import { compactSocialLinks } from '@/lib/utils/social-links';
import { getBaseUrl } from '@/lib/utils/url.server';
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
          <Text key={`separator-${index}`} size="sm" component="span" c="dimmed">
            {separator}
          </Text>,
          value,
        ],
  );
}

export async function ReleasePublicContent({
  release,
  releaseMetadata,
  query,
  requestedLocale,
  uiLocale,
  shareToken,
  sharePassword,
}: {
  release: PublicRelease;
  releaseMetadata: Awaited<ReturnType<typeof getReleaseMetadataDocument>> | null;
  query: Record<string, string | string[] | undefined>;
  requestedLocale: string;
  uiLocale: string;
  shareToken?: string;
  sharePassword?: string;
}) {
  const [t, tCommonEntities, tCommonLabels, tCommonStates, baseUrl] = await Promise.all([
    getTranslations('releasePage'),
    getTranslations('common.entities'),
    getTranslations('common.labels'),
    getTranslations('common.states'),
    getBaseUrl(),
  ]);
  const releaseDate = formatReleaseDate(release.releaseDate, uiLocale);
  const streamingLinks = compactSocialLinks({
    spotify: release.spotifyUrl,
    applemusic: release.appleMusicUrl,
    bandcamp: release.bandcampUrl,
    youtubemusic: release.youtubeMusicUrl,
  });
  const hasLinks = Object.keys(streamingLinks).length > 0;
  const pathname = `/releases/${release.slug || release.id}`;
  const url = `${baseUrl}${pathname}`;
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
      <Stack gap="xl">
        <LocalizationNotice
          pathname={pathname}
          query={query}
          requestedLocale={requestedLocale}
          localizationInfo={release.localizationInfo}
          variant="subtle"
        />
        <div className={classes.hero}>
          <div className={classes.artworkCard}>
            <Box className={classes.artworkMedia}>
              {release.artworkUrl ? (
                <Image
                  src={buildManagedImageUrl(release.artworkUrl, MANAGED_IMAGE_PRESET.COVER_HERO)}
                  alt={release.title}
                  w="100%"
                  h="100%"
                  fit="cover"
                  className={classes.artworkImage}
                />
              ) : (
                <Box h="100%" bg="gray.2" className={classes.artworkPlaceholder} />
              )}
            </Box>
          </div>

          <Stack gap="sm" className={classes.meta}>
            <div className={classes.metaHeader}>
              <Stack gap="sm" className={classes.metaMain}>
                <Title order={1}>{release.title}</Title>
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
                        <Text size="sm" component="span">
                          {releaseArtistFallbackLabel}
                        </Text>
                      )}
                    </PublicMetadataValueGroup>
                  </PublicMetadataRow>
                  <PublicMetadataRow label={tCommonLabels('type')}>
                    <Text size="sm" component="span">
                      {getReleaseTypeLabel(release.type, {
                        album: t('types.album'),
                        ep: t('types.ep'),
                        single: t('types.single'),
                        compilation: t('types.compilation'),
                        release: tCommonEntities('release'),
                      })}
                    </Text>
                  </PublicMetadataRow>
                  <PublicMetadataRow label={tCommonLabels('releaseDate')}>
                    <Text size="sm" component="span">
                      {releaseDate}
                    </Text>
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
                      <Text size="sm" component="span">
                        {release.catalogNumber}
                      </Text>
                    </PublicMetadataRow>
                  )}
                  {release.formats.length > 0 && (
                    <PublicMetadataRow
                      label={release.formats.length > 1 ? tCommonEntities('formats') : tCommonEntities('format')}
                    >
                      <PublicMetadataValueGroup>
                        {joinInlineValues(
                          release.formats.map((format) => (
                            <Text key={format.id} size="sm" component="span">
                              {format.description ? `${format.name} (${format.description})` : format.name}
                            </Text>
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
                            <Text key={genre.id} size="sm" component="span">
                              {genre.name}
                            </Text>
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
                            <Text key={style.id} size="sm" component="span">
                              {style.name}
                            </Text>
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
                      <SocialLinksDisplay links={streamingLinks} variant="button" />
                    </PublicMetadataRow>
                  )}
                </PublicMetadataRows>
              </Stack>
              <Group gap="sm" align="flex-start" className={classes.actions}>
                <ContentLanguageMenu
                  pathname={pathname}
                  query={query}
                  requestedLocale={requestedLocale}
                  localizationInfo={release.localizationInfo}
                />
                <ShareButton url={url} title={release.title} />
              </Group>
            </div>
          </Stack>
        </div>

        {release.content && release.content.length > 0 ? (
          <Stack gap={6}>
            <Text size="sm" c="dimmed" fw={500}>
              {tCommonLabels('description')}
            </Text>
            <div className="prose">
              {release.content.map((block) => (
                <GeneratedRichTextBlockView key={block.id} block={block} requestedLocale={requestedLocale} />
              ))}
            </div>
          </Stack>
        ) : release.descriptionText ? (
          <Stack gap={6}>
            <Text size="sm" c="dimmed" fw={500}>
              {tCommonLabels('description')}
            </Text>
            <Text style={{ whiteSpace: 'pre-wrap' }}>{release.descriptionText}</Text>
          </Stack>
        ) : null}

        {release.tracks.length > 0 && (
          <Stack gap="sm" className={classes.tracksSection}>
            <Text fw={600}>{tCommonEntities('tracks')}</Text>
            {release.tracks.map((track) => (
              <Stack key={track.id} gap={8} className={classes.trackRow}>
                <Group justify="space-between" wrap="nowrap" gap="md" className={classes.trackMeta}>
                  <Text lineClamp={1}>{track.title}</Text>
                  <Text c="dimmed" size="sm">
                    {formatDuration(track.durationMs)}
                  </Text>
                </Group>
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
              </Stack>
            ))}
          </Stack>
        )}
      </Stack>
    </>
  );
}
