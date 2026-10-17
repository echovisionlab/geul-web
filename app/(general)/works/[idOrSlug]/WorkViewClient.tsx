'use client';

import { Text as DsText } from '@/components/core/Typography';

import { LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { useMemo, type ReactNode } from 'react';

import { IconPencil } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

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
import { PrintButton } from '@/features/print/PrintButton';
import {
  SocialLinksDisplayView,
  type SocialLinkDisplayViewModel,
} from '@/features/social-links/ui/SocialLinksDisplayView';
// Leaf modules: these documents have no authored layout, so the collaboration schema stays off the route.
import { DocumentHeadingScope } from '@/features/document-layout/ui/DocumentHeadingScope';
import {
  EntityDetailImage,
  EntityDetailLayout,
  EntityDetailSection,
} from '@/features/document-layout/ui/EntityDetailLayout';
import { TableOfContents } from '@/features/navigation/TableOfContents';
import { GeneratedRichTextBlockView } from '@/features/page/PageView/blocks/GeneratedRichTextBlockView';
import { ContentBlockMediaRuntimeProvider } from '@/features/media/ContentBlockMediaRuntimeContext';
import type { ContentBlockMediaItem } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { PUBLIC_MEDIA_ENTITY_TYPE } from '@/features/media-download/download-wire-values';
import type { LocalizedRichTextBlock } from '@/features/editor/contract/localized-rich-text';
import { ContentLanguageMenu } from '@/features/translation/ContentLanguageMenu';
import { CreditList } from '@/features/work/CreditList';
import { WorkMediaDeliveryProvider } from '@/features/work/WorkMediaDeliveryContext';
import { buildGeneratedBlockTocItems } from '@/lib/toc-items';
import type { WorkType } from '@/lib/types/work/model';
import type { LocationPlaceSummary } from '@/lib/utils/location-place';
import { formatWorkPeriodLabel } from '@/lib/utils/work-period';

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
  pathname: string;
  query?: Record<string, string | string[] | undefined>;
  requestedLocale: string;
  shareToken?: string;
  sharePassword?: string;
  /** Music project links prepared on the server by `prepareWorkMusicLinks`. */
  musicLinkEntries: SocialLinkDisplayViewModel[];
}

export function WorkViewClient({
  work,
  pathname,
  query,
  requestedLocale,
  shareToken,
  sharePassword,
  musicLinkEntries,
}: Props) {
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
        <DsText size="sm" as="span">
          {value}
        </DsText>
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

  const contentLang = work.localizationInfo?.displayedLocale || work.localizationInfo?.sourceLocale || requestedLocale;
  const hasCredits = Boolean(credits && (credits.groups.length > 0 || credits.ungrouped.length > 0));

  return (
    <WorkMediaDeliveryProvider
      idOrSlug={work.slug || work.id}
      requestedLocale={requestedLocale}
      shareToken={shareToken}
      sharePassword={sharePassword}
    >
      <ContentBlockMediaRuntimeProvider items={work.blockMedia}>
        <EntityDetailLayout
          media={work.featuredImageUrl ? <EntityDetailImage src={work.featuredImageUrl} alt={work.title} /> : undefined}
          printMedia="overlay"
          title={work.title || tCommonStates('untitledPlain')}
          titleLang={contentLang}
          actions={
            <DsLayoutInline gap="xs">
              {languageMenu}
              {work.canEdit && (
                <Tooltip label={tCommonActions('edit')}>
                  <IconButton
                    tone="neutral"
                    emphasis="low"
                    size="lg"
                    href={`/works/${work.id}?edit=true`}
                    aria-label={t('actions.editAria')}
                  >
                    <IconPencil size={22} />
                  </IconButton>
                </Tooltip>
              )}
              <PrintButton />
            </DsLayoutInline>
          }
          meta={
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
              {work.type === 'music_project' && (
                <MusicProjectMeta metadata={metadata} musicLinkEntries={musicLinkEntries} />
              )}
              {work.type === 'portfolio' && <PortfolioMeta metadata={metadata} />}
              {work.type === 'article' && <ArticleMeta metadata={metadata} />}
              {work.type === 'contribution' && <ContributionMeta metadata={metadata} />}
            </PublicMetadataRows>
          }
        >
          {work.content && work.content.length > 0 ? (
            <EntityDetailSection title={tCommonLabels('description')}>
              <TableOfContents
                items={tocItems}
                contentPlacement="start"
                outlinePresentation={work.featuredImageUrl ? 'rail' : 'responsive'}
              >
                <div className="prose" lang={contentLang}>
                  {/* The authored body sits under the level-2 section title: authored H1 → h3. */}
                  <DocumentHeadingScope parentLevel={2}>
                    {work.content.map((block) => (
                      <GeneratedRichTextBlockView
                        key={block.id}
                        block={block}
                        requestedLocale={requestedLocale}
                        downloadOwner={{ entityType: PUBLIC_MEDIA_ENTITY_TYPE.WORK, entityId: work.id }}
                      />
                    ))}
                  </DocumentHeadingScope>
                </div>
              </TableOfContents>
            </EntityDetailSection>
          ) : null}
          {hasCredits && credits ? (
            <EntityDetailSection title={tCommonEntities('credits')}>
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
            </EntityDetailSection>
          ) : null}
          {clients && clients.length > 0 ? (
            <EntityDetailSection title={tCommonEntities('clients')}>
              <DsLayoutInline gap="md">
                {clients.map((client) => (
                  <ClientPublicMark key={client.id} {...client} />
                ))}
              </DsLayoutInline>
            </EntityDetailSection>
          ) : null}
        </EntityDetailLayout>
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

function MusicProjectMeta({
  metadata,
  musicLinkEntries,
}: {
  metadata: Record<string, unknown>;
  musicLinkEntries: SocialLinkDisplayViewModel[];
}) {
  const tCommonLabels = useTranslations('common.labels');
  const releaseDate = metadata.releaseDate as string | undefined;
  const hasLinks = musicLinkEntries.length > 0;

  return (
    <>
      {releaseDate && (
        <PublicMetadataRow label={tCommonLabels('releaseDate')}>
          <DsText size="sm" as="span">
            {releaseDate}
          </DsText>
        </PublicMetadataRow>
      )}
      {hasLinks && (
        <PublicMetadataRow label={tCommonLabels('links')}>
          <SocialLinksDisplayView entries={musicLinkEntries} variant="button" iconButtonEmphasis="medium" />
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
          <PublicMetadataLink href={projectUrl} external indicator="external">
            {formatDisplayUrl(projectUrl)}
          </PublicMetadataLink>
        </PublicMetadataRow>
      )}
      {technologies && technologies.length > 0 && (
        <PublicMetadataRow label={trimMetadataLabel(t('tech'))}>
          <PublicMetadataValueGroup>
            {technologies.map((tech) => (
              <DsText key={tech} size="sm" as="span">
                {tech}
              </DsText>
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
          <PublicMetadataLink href={externalUrl} external indicator="external">
            {formatDisplayUrl(externalUrl)}
          </PublicMetadataLink>
        </PublicMetadataRow>
      )}
      {publication && (
        <PublicMetadataRow label={trimMetadataLabel(t('publication'))}>
          <DsText size="sm" as="span">
            {publication}
          </DsText>
        </PublicMetadataRow>
      )}
      {publishedDate && (
        <PublicMetadataRow label={trimMetadataLabel(t('date'))}>
          <DsText size="sm" as="span">
            {publishedDate}
          </DsText>
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
          <DsText size="sm" as="span">
            {url ? (
              <PublicMetadataLink href={url} external>
                {projectName}
              </PublicMetadataLink>
            ) : (
              projectName
            )}
          </DsText>
        </PublicMetadataRow>
      )}
      {role && (
        <PublicMetadataRow label={trimMetadataLabel(t('role'))}>
          <DsText size="sm" as="span">
            {role}
          </DsText>
        </PublicMetadataRow>
      )}
    </>
  );
}
