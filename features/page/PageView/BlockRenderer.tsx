// Server Component - no 'use client'
// Import server components directly from ViewServer files to avoid client bundle pollution
import { ArtistListViewStreaming } from '@/features/page/blocks/artist-grid/ViewServer';
import { AuthorListViewStreaming } from '@/features/page/blocks/author-list/ViewServer';
import { ClientMarqueeViewServer } from '@/features/page/blocks/client-marquee/ViewServer';
import { FormView } from '@/features/page/blocks/form/View';
import { PageExternalVideoView } from '@/features/page/blocks/external-video/View';
import { ImmersiveSceneView } from '@/features/page/blocks/immersive-scene/View';
import { LabelListViewStreaming } from '@/features/page/blocks/label-list/ViewServer';
import { LabelMarqueeViewServer } from '@/features/page/blocks/label-marquee/ViewServer';
import { MapView } from '@/features/page/blocks/map/View';
import { PostListViewStreaming } from '@/features/page/blocks/post-list/ViewServer';
import { PostMapViewStreaming } from '@/features/page/blocks/post-map/ViewServer';
import { PostTableViewStreaming } from '@/features/page/blocks/post-table/ViewServer';
import { ProgramEventListViewStreaming } from '@/features/page/blocks/program-event-list/ViewServer';
import { ReleaseListViewStreaming } from '@/features/page/blocks/releases-gallery/ViewServer';
import { RichTextView } from '@/features/page/blocks/rich-text/View';
import { TextMarqueeView } from '@/features/page/blocks/text-marquee/View';
import { WorkMapViewStreaming } from '@/features/page/blocks/work-map/ViewServer';
import { WorkTableViewStreaming } from '@/features/page/blocks/work-table/ViewServer';
import { WorkListViewStreaming } from '@/features/page/blocks/works-gallery/ViewServer';
import { dedupePageContent, dedupePageSections } from '@/features/page/page-section-dedupe';
import { getPageSectionStyle } from '@/features/page/section-style';
import type { PageContent, Section } from '@/lib/types/page-content';
import classes from './BlockRenderer.module.css';

// ============================================================================
// Page Renderer
// ============================================================================

interface PageRendererProps {
  content: PageContent;
  query?: Record<string, string | string[] | undefined>;
  requestedLocale?: string;
}

export function PageRenderer({ content, query, requestedLocale }: PageRendererProps) {
  const dedupedContent = dedupePageContent(content);

  return (
    <div className={`page-sections ${classes.sections}`}>
      {dedupedContent.sections.map((section) => (
        <SectionView key={section.id} section={section} query={query} requestedLocale={requestedLocale} />
      ))}
    </div>
  );
}

// ============================================================================
// Section View
// ============================================================================

interface SectionViewProps {
  section: Section;
  query?: Record<string, string | string[] | undefined>;
  requestedLocale?: string;
}

function SectionView({ section, query, requestedLocale }: SectionViewProps) {
  const { settings } = section;
  const style = getPageSectionStyle(settings);

  return (
    <section
      className={`page-section ${classes.section}`}
      data-section-id={section.id}
      data-section-type={section.type}
      style={style}
    >
      <SectionContent section={section} query={query} requestedLocale={requestedLocale} />
    </section>
  );
}

function SectionContent({ section, query, requestedLocale }: SectionViewProps) {
  const props = section.props || {};

  // Data-fetching blocks - use streaming server components
  switch (section.type) {
    case 'post-list':
      return (
        <PostListViewStreaming sectionId={section.id} props={props} query={query} requestedLocale={requestedLocale} />
      );
    case 'post-table':
      return (
        <PostTableViewStreaming sectionId={section.id} props={props} query={query} requestedLocale={requestedLocale} />
      );
    case 'post-map':
      return (
        <PostMapViewStreaming sectionId={section.id} props={props} query={query} requestedLocale={requestedLocale} />
      );
    case 'work-map':
      return (
        <WorkMapViewStreaming sectionId={section.id} props={props} query={query} requestedLocale={requestedLocale} />
      );
    case 'work-table':
      return (
        <WorkTableViewStreaming sectionId={section.id} props={props} query={query} requestedLocale={requestedLocale} />
      );
    case 'author-list':
      return (
        <AuthorListViewStreaming sectionId={section.id} props={props} query={query} requestedLocale={requestedLocale} />
      );
    case 'work-list':
      return (
        <WorkListViewStreaming sectionId={section.id} props={props} query={query} requestedLocale={requestedLocale} />
      );
    case 'program-event-list':
      return (
        <ProgramEventListViewStreaming
          sectionId={section.id}
          props={props}
          query={query}
          requestedLocale={requestedLocale}
        />
      );
    case 'release-list':
      return (
        <ReleaseListViewStreaming
          sectionId={section.id}
          props={props}
          query={query}
          requestedLocale={requestedLocale}
        />
      );
    case 'artist-list':
      return (
        <ArtistListViewStreaming sectionId={section.id} props={props} query={query} requestedLocale={requestedLocale} />
      );
    case 'label-list':
      return (
        <LabelListViewStreaming sectionId={section.id} props={props} query={query} requestedLocale={requestedLocale} />
      );
    case 'text-marquee':
      return <TextMarqueeView sectionId={section.id} props={props} query={query} requestedLocale={requestedLocale} />;
    case 'client-marquee':
      return (
        <ClientMarqueeViewServer sectionId={section.id} props={props} query={query} requestedLocale={requestedLocale} />
      );
    case 'label-marquee':
      return (
        <LabelMarqueeViewServer sectionId={section.id} props={props} query={query} requestedLocale={requestedLocale} />
      );
    case 'form':
      return <FormView sectionId={section.id} props={props} query={query} requestedLocale={requestedLocale} />;
    case 'map':
      return <MapView sectionId={section.id} props={props} query={query} requestedLocale={requestedLocale} />;
    case 'immersive-scene':
      return (
        <ImmersiveSceneView sectionId={section.id} props={props} query={query} requestedLocale={requestedLocale} />
      );
    case 'external-video':
      return (
        <PageExternalVideoView sectionId={section.id} props={props} query={query} requestedLocale={requestedLocale} />
      );

    // Static blocks - using registry View components
    case 'rich-text':
      return (
        <RichTextView
          sectionId={section.id}
          props={props}
          query={query}
          requestedLocale={requestedLocale}
          content={section.content}
        />
      );

    case 'columns':
      return <ColumnsSection section={section} query={query} requestedLocale={requestedLocale} />;

    default:
      return null;
  }
}

function ColumnsSection({ section, query, requestedLocale }: SectionViewProps) {
  const props = section.props || {};
  const columnRatios = (props.columnRatios as string) || '1:1';
  const gap = (props.gap as string) || '24';

  const ratios = columnRatios.split(':').map(Number);
  const gridTemplateColumns = ratios.map((r) => `${r}fr`).join(' ');

  const dedupedColumns =
    section.columns?.map((column) => ({
      ...column,
      sections: dedupePageSections(column.sections),
    })) ?? [];

  return (
    <div
      className="columns-section"
      style={{
        display: 'grid',
        gridTemplateColumns,
        gap: `${gap}px`,
      }}
    >
      {dedupedColumns.map((column) => (
        <div key={column.id} className="column-content">
          {column.sections.map((child) => (
            <SectionContent key={child.id} section={child} query={query} requestedLocale={requestedLocale} />
          ))}
        </div>
      ))}
    </div>
  );
}
