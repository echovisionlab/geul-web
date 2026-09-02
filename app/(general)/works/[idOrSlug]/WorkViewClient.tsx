'use client';

import { useMemo, type ReactNode } from 'react';
import Link from 'next/link';
import { IconExternalLink, IconPencil } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Box, Divider, Group, Stack, Text, Title } from '@mantine/core';
import { IconButton } from '@/components/core/IconButton';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { Tooltip } from '@/components/core/Tooltip';
import { ClientPublicMark } from '@/features/client/ClientPublicMark';
import { LocationPlaceMetadataRows } from '@/features/location/LocationPlaceMetadataRows';
import {
  PublicMetadataLink,
  PublicMetadataRow,
  PublicMetadataRows,
  PublicMetadataValueGroup,
} from '@/components/core/PublicMetadata';
import { ShareButton } from '@/features/share/ShareButton';
import { PrintButton } from '@/features/print/PrintButton';
import { SocialLinksDisplay } from '@/features/social-links/SocialLinksDisplay';
import { TableOfContents } from '@/features/navigation/TableOfContents';
import { GeneratedRichTextBlockView } from '@/features/page/PageView/blocks/GeneratedRichTextBlockView';
import { ContentBlockMediaRuntimeProvider } from '@/features/media/ContentBlockMediaRuntimeContext';
import type { ContentBlockMediaItem } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { PublicMediaEntityType } from '@echovisionlab/geul-proto/public/file_pb.ts';
import type { LocalizedRichTextBlock } from '@/features/editor/contract/localized-rich-text';
import { ContentLanguageMenu } from '@/features/translation/ContentLanguageMenu';
import { CreditList } from '@/features/work/CreditList';
import { WorkPublicHeaderLayout } from '@/features/work/WorkPublicHeaderLayout';
import { WorkMediaDeliveryProvider } from '@/features/work/WorkMediaDeliveryContext';
import { buildGeneratedBlockTocItems } from '@/lib/toc-items';
import type { WorkType } from '@/lib/types/work/model';
import type { LocationPlaceSummary } from '@/lib/utils/location-place';
import { compactSocialLinks } from '@/lib/utils/social-links';
import { formatWorkPeriodLabel } from '@/lib/utils/work-period';
import classes from './WorkViewClient.module.css';

interface Credit {
  id: string;
  name: string | null;
  creditRole: string | null;
  imageUrl: string | null;
  artistId: string | null;
  artistSlug: string | null;
  memberId: string | null;
}

interface CreditGroup {
  id: string;
  name: string;
  credits: Credit[];
}

interface Client {
  id: string;
  name: string;
  logoUrl: string | null;
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  website: string | null;
}

interface WorkData {
  id: string;
  slug: string | null;
  title: string;
  type: string;
  year: number;
  month: number;
  untilYear: number | null;
  untilMonth: number | null;
  isPresent: boolean;
  summary: string | null;
  featuredImageUrl: string | null;
  metadata: Record<string, unknown>;
  content: readonly LocalizedRichTextBlock[] | null;
  blockMedia: readonly ContentBlockMediaItem[];
  locationPlace: LocationPlaceSummary | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  credits: {
    groups: CreditGroup[];
    ungrouped: Credit[];
  };
  clients: Client[];
  canEdit: boolean;
  localizationInfo?: {
    requestedLocale: string;
    displayedLocale: string;
    sourceLocale: string;
    isFallback: boolean;
    isOriginal: boolean;
    machineGenerated: boolean;
    fallbackReason: number;
    availableLocales?: string[];
  } | null;
}

interface Props {
  work: WorkData;
  shareUrl: string;
  pathname: string;
  query?: Record<string, string | string[] | undefined>;
  requestedLocale: string;
  shareToken?: string;
  sharePassword?: string;
}

export function WorkViewClient({ work, shareUrl, pathname, query, requestedLocale, shareToken, sharePassword }: Props) {
  const dateTime = useDateTimeFormatter();
  const t = useTranslations('workView');
  const tCommonActions = useTranslations('common.actions');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonStates = useTranslations('common.states');
  const tWorkTypes = useTranslations('works.types');
  const metadata = work.metadata as Record<string, unknown>;
  const tocItems = useMemo(() => buildGeneratedBlockTocItems(work.content), [work.content]);
  const { credits, clients } = work;
  const periodLabel = formatWorkPeriodLabel(work.year, work.month, work.untilYear, work.untilMonth, work.isPresent);

  const hasCreditsOrClients =
    (credits && (credits.groups.length > 0 || credits.ungrouped.length > 0)) || (clients && clients.length > 0);

  const getWorkTypeLabel = (type: string) => {
    switch (type as WorkType) {
      case 'music_project':
        return tWorkTypes('music_project');
      case 'portfolio':
        return tWorkTypes('portfolio');
      case 'article':
        return tWorkTypes('article');
      case 'contribution':
        return tWorkTypes('contribution');
      default:
        return type;
    }
  };

  const renderDetailRow = (label: string, value: string | null) =>
    value ? (
      <PublicMetadataRow label={label}>
        <Text size="sm" component="span">
          {value}
        </Text>
      </PublicMetadataRow>
    ) : null;

  const languageMenu: ReactNode = work.localizationInfo ? (
    <ContentLanguageMenu
      pathname={pathname}
      query={query}
      requestedLocale={requestedLocale}
      localizationInfo={work.localizationInfo}
    />
  ) : null;

  const MetadataSection = () => (
    <div className={classes.metadata}>
      <Group justify="space-between" align="flex-start">
        <Stack gap="xs" style={{ flex: 1 }}>
          <Title order={1} style={{ fontWeight: 700, fontSize: '1.5rem' }}>
            {work.title || tCommonStates('untitledPlain')}
          </Title>
          <PublicMetadataRows>
            {renderDetailRow(tCommonLabels('type'), getWorkTypeLabel(work.type))}
            {renderDetailRow(t('details.period'), periodLabel)}
            {work.publishedAt &&
              work.updatedAt &&
              work.updatedAt !== work.publishedAt &&
              renderDetailRow(tCommonLabels('updated'), dateTime.dateTime(work.updatedAt))}
            {!work.publishedAt &&
              work.updatedAt &&
              renderDetailRow(tCommonLabels('lastEdited'), dateTime.dateTime(work.updatedAt))}
            {work.locationPlace && (
              <LocationPlaceMetadataRows place={work.locationPlace} textSize="sm" coordinateVisibility="desktop" />
            )}
            {work.type === 'music_project' && <MusicProjectMeta metadata={metadata} />}
            {work.type === 'portfolio' && <PortfolioMeta metadata={metadata} />}
            {work.type === 'article' && <ArticleMeta metadata={metadata} />}
            {work.type === 'contribution' && <ContributionMeta metadata={metadata} />}
          </PublicMetadataRows>
        </Stack>
        <Group gap="xs">
          {languageMenu}
          {work.canEdit && (
            <Tooltip label={tCommonActions('edit')}>
              <IconButton
                tone="neutral"
                emphasis="low"
                size="md"
                component={Link}
                href={`/works/${work.id}?edit=true`}
                style={{ minWidth: 44, minHeight: 44 }}
                aria-label={t('actions.editAria')}
              >
                <IconPencil size={22} />
              </IconButton>
            </Tooltip>
          )}
          <PrintButton />
          <ShareButton url={shareUrl} title={work.title || tCommonStates('untitledPlain')} size="md" />
        </Group>
      </Group>

      {hasCreditsOrClients && (
        <>
          <Divider />
          <Stack gap="md">
            {credits && (credits.groups.length > 0 || credits.ungrouped.length > 0) && (
              <CreditList>
                {credits.groups.map((group) => (
                  <CreditList.Group key={group.id} name={group.name}>
                    {group.credits.map((c) => (
                      <CreditList.Item
                        key={c.id}
                        name={c.name || tCommonStates('unknown')}
                        role={c.creditRole}
                        imageUrl={c.imageUrl}
                        href={
                          c.artistSlug || c.artistId
                            ? `/artists/${c.artistSlug || c.artistId}`
                            : c.memberId
                              ? `/user/${c.memberId}`
                              : null
                        }
                      />
                    ))}
                  </CreditList.Group>
                ))}
                {credits.ungrouped.length > 0 && (
                  <CreditList.Group name={t('credits.other')}>
                    {credits.ungrouped.map((c) => (
                      <CreditList.Item
                        key={c.id}
                        name={c.name || tCommonStates('unknown')}
                        role={c.creditRole}
                        imageUrl={c.imageUrl}
                        href={
                          c.artistSlug || c.artistId
                            ? `/artists/${c.artistSlug || c.artistId}`
                            : c.memberId
                              ? `/user/${c.memberId}`
                              : null
                        }
                      />
                    ))}
                  </CreditList.Group>
                )}
              </CreditList>
            )}

            {clients && clients.length > 0 && (
              <Stack gap="sm">
                <Text size="sm" fw={500}>
                  {tCommonEntities('clients')}
                </Text>
                <Group gap="md">
                  {clients.map((client) => (
                    <ClientPublicMark key={client.id} {...client} />
                  ))}
                </Group>
              </Stack>
            )}
          </Stack>
        </>
      )}
    </div>
  );

  return (
    <WorkMediaDeliveryProvider
      idOrSlug={work.slug || work.id}
      requestedLocale={requestedLocale}
      shareToken={shareToken}
      sharePassword={sharePassword}
    >
      <ContentBlockMediaRuntimeProvider items={work.blockMedia}>
        <article className={classes.document} data-work-document="">
          <WorkPublicHeaderLayout featuredImageUrl={work.featuredImageUrl} imageAlt={work.title}>
            <MetadataSection />
          </WorkPublicHeaderLayout>

          <Divider className={classes.divider} />

          {work.content && work.content.length > 0 ? (
            <Box className={`prose ${classes.content}`}>
              {work.content.map((block) => (
                <GeneratedRichTextBlockView
                  key={block.id}
                  block={block}
                  requestedLocale={requestedLocale}
                  downloadOwner={{ entityType: PublicMediaEntityType.WORK, entityId: work.id }}
                />
              ))}
            </Box>
          ) : null}
        </article>
        <TableOfContents items={tocItems} />
      </ContentBlockMediaRuntimeProvider>
    </WorkMediaDeliveryProvider>
  );
}

function formatDisplayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function trimMetadataLabel(label: string): string {
  return label.replace(/:\s*$/, '');
}

function MusicProjectMeta({ metadata }: { metadata: Record<string, unknown> }) {
  const tCommonLabels = useTranslations('common.labels');
  const releaseDate = metadata.releaseDate as string | undefined;
  const spotifyUrl = metadata.spotifyUrl as string | undefined;
  const bandcampUrl = metadata.bandcampUrl as string | undefined;
  const soundcloudUrl = metadata.soundcloudUrl as string | undefined;
  const youtubeUrl = metadata.youtubeUrl as string | undefined;
  const musicLinks = compactSocialLinks({
    spotify: spotifyUrl,
    bandcamp: bandcampUrl,
    soundcloud: soundcloudUrl,
    youtube: youtubeUrl,
  });
  const hasLinks = Object.keys(musicLinks).length > 0;

  return (
    <>
      {releaseDate && (
        <PublicMetadataRow label={tCommonLabels('releaseDate')}>
          <Text size="sm" component="span">
            {releaseDate}
          </Text>
        </PublicMetadataRow>
      )}
      {hasLinks && (
        <PublicMetadataRow label={tCommonLabels('links')}>
          <SocialLinksDisplay links={musicLinks} variant="button" iconButtonEmphasis="medium" />
        </PublicMetadataRow>
      )}
    </>
  );
}

function PortfolioMeta({ metadata }: { metadata: Record<string, unknown> }) {
  const t = useTranslations('workView.portfolio');
  const tCommonLabels = useTranslations('common.labels');
  const projectUrl = metadata.projectUrl as string | undefined;
  const technologies = metadata.technologies as string[] | undefined;

  return (
    <>
      {projectUrl && (
        <PublicMetadataRow label={tCommonLabels('website')}>
          <PublicMetadataLink href={projectUrl} external>
            {formatDisplayUrl(projectUrl)}
            <IconExternalLink size={12} style={{ marginLeft: 4 }} />
          </PublicMetadataLink>
        </PublicMetadataRow>
      )}
      {technologies && technologies.length > 0 && (
        <PublicMetadataRow label={trimMetadataLabel(t('tech'))}>
          <PublicMetadataValueGroup>
            {technologies.map((tech) => (
              <Text key={tech} size="sm" component="span">
                {tech}
              </Text>
            ))}
          </PublicMetadataValueGroup>
        </PublicMetadataRow>
      )}
    </>
  );
}

function ArticleMeta({ metadata }: { metadata: Record<string, unknown> }) {
  const t = useTranslations('workView.article');
  const externalUrl = metadata.externalUrl as string | undefined;
  const publication = metadata.publication as string | undefined;
  const publishedDate = metadata.publishedDate as string | undefined;

  return (
    <>
      {externalUrl && (
        <PublicMetadataRow label={trimMetadataLabel(t('article'))}>
          <PublicMetadataLink href={externalUrl} external>
            {formatDisplayUrl(externalUrl)}
            <IconExternalLink size={12} style={{ marginLeft: 4 }} />
          </PublicMetadataLink>
        </PublicMetadataRow>
      )}
      {publication && (
        <PublicMetadataRow label={trimMetadataLabel(t('publication'))}>
          <Text size="sm" component="span">
            {publication}
          </Text>
        </PublicMetadataRow>
      )}
      {publishedDate && (
        <PublicMetadataRow label={trimMetadataLabel(t('date'))}>
          <Text size="sm" component="span">
            {publishedDate}
          </Text>
        </PublicMetadataRow>
      )}
    </>
  );
}

function ContributionMeta({ metadata }: { metadata: Record<string, unknown> }) {
  const t = useTranslations('workView.contribution');
  const projectName = metadata.projectName as string | undefined;
  const role = metadata.role as string | undefined;
  const url = metadata.url as string | undefined;

  return (
    <>
      {projectName && (
        <PublicMetadataRow label={trimMetadataLabel(t('project'))}>
          <Text size="sm" component="span">
            {url ? (
              <PublicMetadataLink href={url} external>
                {projectName}
              </PublicMetadataLink>
            ) : (
              projectName
            )}
          </Text>
        </PublicMetadataRow>
      )}
      {role && (
        <PublicMetadataRow label={trimMetadataLabel(t('role'))}>
          <Text size="sm" component="span">
            {role}
          </Text>
        </PublicMetadataRow>
      )}
    </>
  );
}
