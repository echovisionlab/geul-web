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
import { TextMarqueeView } from '@/features/page/blocks/text-marquee/View';
import { WorkMapViewStreaming } from '@/features/page/blocks/work-map/ViewServer';
import { WorkTableViewStreaming } from '@/features/page/blocks/work-table/ViewServer';
import { WorkListViewStreaming } from '@/features/page/blocks/works-gallery/ViewServer';
import { assertNever } from '@/features/editor/contract/block-registry';
import type { LocalizedPageSection } from '@/features/editor/contract/localized-page';
import { getPageSectionStyle } from '@/features/page/section-style';
import { GeneratedRichTextBlockView } from './blocks/GeneratedRichTextBlockView';
import classes from './BlockRenderer.module.css';

interface Props {
  sections: readonly LocalizedPageSection[];
  query?: Record<string, string | string[] | undefined>;
  requestedLocale?: string;
}

export function GeneratedPageRenderer({ sections, query, requestedLocale }: Props) {
  return (
    <div className={`page-sections ${classes.sections}`}>
      {sections.map((section) => (
        <section
          key={section.id}
          className={`page-section ${classes.section}`}
          data-section-id={section.id}
          data-section-type={section.kind}
          style={getPageSectionStyle(section.settings)}
        >
          <GeneratedSectionContent section={section} query={query} requestedLocale={requestedLocale} />
        </section>
      ))}
    </div>
  );
}

function GeneratedSectionContent({
  section,
  query,
  requestedLocale,
}: {
  section: LocalizedPageSection;
  query?: Record<string, string | string[] | undefined>;
  requestedLocale?: string;
}) {
  const props = section.props;
  switch (section.kind) {
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
    case 'author-list':
      return (
        <AuthorListViewStreaming sectionId={section.id} props={props} query={query} requestedLocale={requestedLocale} />
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
    case 'rich-text':
      return (
        section.richText?.map((block) => (
          <GeneratedRichTextBlockView
            key={block.id}
            block={block}
            requestedLocale={requestedLocale}
            allowStandaloneExternalVideo
          />
        )) ?? null
      );
    case 'columns': {
      const gap = Number(props.gap ?? 24);
      return (
        <div
          className="columns-section"
          style={{
            display: 'grid',
            gridTemplateColumns: section.columns.map((column) => `${column.ratio}fr`).join(' '),
            gap: `${Number.isFinite(gap) ? gap : 24}px`,
          }}
        >
          {section.columns.map((column) => (
            <div key={column.id} className="column-content">
              {column.sections.map((child) => (
                <GeneratedSectionContent
                  key={child.id}
                  section={child}
                  query={query}
                  requestedLocale={requestedLocale}
                />
              ))}
            </div>
          ))}
        </div>
      );
    }
    default:
      return assertNever(section.kind, 'Unsupported generated Page section kind.');
  }
}
