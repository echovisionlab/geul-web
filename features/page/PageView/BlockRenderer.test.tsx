import { createPageBlockFixtureSections } from '@echovisionlab/geul-common/page';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PageContent } from '@/lib/types/page-content';

const blockViewCalls = vi.hoisted(() => new Map<string, Array<Record<string, unknown>>>());

function createMockBlockView(type: string, exportName: string) {
  return {
    [exportName]: ({
      sectionId,
      props,
      content,
      columns,
    }: {
      sectionId?: string;
      props?: Record<string, unknown>;
      content?: unknown[];
      columns?: unknown[];
    }) => {
      const calls = blockViewCalls.get(type) ?? [];
      const call: Record<string, unknown> = {
        sectionId,
        props,
        content,
        columns,
      };
      calls.push(call);
      blockViewCalls.set(type, calls);

      return (
        <div
          data-block-view={type}
          data-section-id={sectionId ?? ''}
          data-has-content={content && content.length > 0 ? 'true' : 'false'}
          data-has-columns={columns && columns.length > 0 ? 'true' : 'false'}
        />
      );
    },
  };
}

vi.mock('@/features/page/blocks/artist-grid/ViewServer', () =>
  createMockBlockView('artist-list', 'ArtistListViewStreaming'),
);
vi.mock('@/features/page/blocks/label-list/ViewServer', () =>
  createMockBlockView('label-list', 'LabelListViewStreaming'),
);
vi.mock('@/features/page/blocks/author-list/ViewServer', () =>
  createMockBlockView('author-list', 'AuthorListViewStreaming'),
);
vi.mock('@/features/page/blocks/form/View', () => createMockBlockView('form', 'FormView'));
vi.mock('@/features/page/blocks/immersive-scene/View', () =>
  createMockBlockView('immersive-scene', 'ImmersiveSceneView'),
);
vi.mock('@/features/page/blocks/map/View', () => createMockBlockView('map', 'MapView'));
vi.mock('@/features/page/blocks/external-video/View', () =>
  createMockBlockView('external-video', 'PageExternalVideoView'),
);
vi.mock('@/features/page/blocks/text-marquee/View', () => createMockBlockView('text-marquee', 'TextMarqueeView'));
vi.mock('@/features/page/blocks/client-marquee/ViewServer', () =>
  createMockBlockView('client-marquee', 'ClientMarqueeViewServer'),
);
vi.mock('@/features/page/blocks/label-marquee/ViewServer', () =>
  createMockBlockView('label-marquee', 'LabelMarqueeViewServer'),
);
vi.mock('@/features/page/blocks/post-list/ViewServer', () => createMockBlockView('post-list', 'PostListViewStreaming'));
vi.mock('@/features/page/blocks/post-table/ViewServer', () =>
  createMockBlockView('post-table', 'PostTableViewStreaming'),
);
vi.mock('@/features/page/blocks/post-map/ViewServer', () => createMockBlockView('post-map', 'PostMapViewStreaming'));
vi.mock('@/features/page/blocks/work-map/ViewServer', () => createMockBlockView('work-map', 'WorkMapViewStreaming'));
vi.mock('@/features/page/blocks/work-table/ViewServer', () =>
  createMockBlockView('work-table', 'WorkTableViewStreaming'),
);
vi.mock('@/features/page/blocks/program-event-list/ViewServer', () =>
  createMockBlockView('program-event-list', 'ProgramEventListViewStreaming'),
);
vi.mock('@/features/page/blocks/releases-gallery/ViewServer', () =>
  createMockBlockView('release-list', 'ReleaseListViewStreaming'),
);
vi.mock('@/features/page/blocks/rich-text/View', () => createMockBlockView('rich-text', 'RichTextView'));
vi.mock('@/features/page/blocks/works-gallery/ViewServer', () =>
  createMockBlockView('work-list', 'WorkListViewStreaming'),
);

let PageRenderer: typeof import('./BlockRenderer').PageRenderer;

describe('PageRenderer', () => {
  beforeAll(async () => {
    ({ PageRenderer } = await import('./BlockRenderer'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    blockViewCalls.clear();
  });

  it('renders every supported block type from the shared fixture', () => {
    const fixtureSections = createPageBlockFixtureSections();
    const content: PageContent = {
      sections: fixtureSections,
    };

    const html = renderToStaticMarkup(<PageRenderer content={content} query={{}} />);

    expect(html).toContain('data-section-type="rich-text"');
    expect(html).toContain('data-section-id="fixture-section-rich-text"');
    expect(html).toContain('data-section-type="post-list"');
    expect(html).toContain('data-section-type="post-table"');
    expect(html).toContain('data-section-type="post-map"');
    expect(html).toContain('data-section-type="work-map"');
    expect(html).toContain('data-section-type="work-table"');
    expect(html).toContain('data-section-type="author-list"');
    expect(html).toContain('data-section-type="work-list"');
    expect(html).toContain('data-section-type="program-event-list"');
    expect(html).toContain('data-section-type="release-list"');
    expect(html).toContain('data-section-type="artist-list"');
    expect(html).toContain('data-section-type="label-list"');
    expect(html).toContain('data-section-type="form"');
    expect(html).toContain('data-section-type="map"');
    expect(html).toContain('data-section-type="immersive-scene"');
    expect(html).toContain('data-section-type="text-marquee"');
    expect(html).toContain('data-section-type="client-marquee"');
    expect(html).toContain('data-section-type="label-marquee"');
    expect(html).toContain('data-section-type="external-video"');
    expect(html).toContain('data-section-type="columns"');
    expect(html).toContain('data-block-view="rich-text"');
    expect(html).toContain('data-block-view="post-list"');
    expect(html).toContain('data-block-view="post-table"');
    expect(html).toContain('data-block-view="post-map"');
    expect(html).toContain('data-block-view="work-map"');
    expect(html).toContain('data-block-view="work-table"');
    expect(html).toContain('data-block-view="author-list"');
    expect(html).toContain('data-block-view="work-list"');
    expect(html).toContain('data-block-view="program-event-list"');
    expect(html).toContain('data-block-view="release-list"');
    expect(html).toContain('data-block-view="artist-list"');
    expect(html).toContain('data-block-view="label-list"');
    expect(html).toContain('data-block-view="form"');
    expect(html).toContain('data-block-view="map"');
    expect(html).toContain('data-block-view="immersive-scene"');
    expect(html).toContain('data-block-view="text-marquee"');
    expect(html).toContain('data-block-view="client-marquee"');
    expect(html).toContain('data-block-view="label-marquee"');
    expect(html).toContain('data-block-view="external-video"');
    expect(html).toContain('class="columns-section"');
    expect(html).toContain('data-section-id="fixture-column-rich-text"');
    expect(html).toContain('data-section-id="fixture-column-external-video"');

    const richTextSection = fixtureSections.find((section) => section.type === 'rich-text');
    const postListSection = fixtureSections.find((section) => section.type === 'post-list');
    const postTableSection = fixtureSections.find((section) => section.type === 'post-table');
    const postMapSection = fixtureSections.find((section) => section.type === 'post-map');
    const workMapSection = fixtureSections.find((section) => section.type === 'work-map');
    const workTableSection = fixtureSections.find((section) => section.type === 'work-table');
    const authorListSection = fixtureSections.find((section) => section.type === 'author-list');
    const workListSection = fixtureSections.find((section) => section.type === 'work-list');
    const programEventListSection = fixtureSections.find((section) => section.type === 'program-event-list');
    const releaseListSection = fixtureSections.find((section) => section.type === 'release-list');
    const artistListSection = fixtureSections.find((section) => section.type === 'artist-list');
    const labelListSection = fixtureSections.find((section) => section.type === 'label-list');
    const formSection = fixtureSections.find((section) => section.type === 'form');
    const mapSection = fixtureSections.find((section) => section.type === 'map');
    const immersiveSceneSection = fixtureSections.find((section) => section.type === 'immersive-scene');
    const textMarqueeSection = fixtureSections.find((section) => section.type === 'text-marquee');
    const clientMarqueeSection = fixtureSections.find((section) => section.type === 'client-marquee');
    const labelMarqueeSection = fixtureSections.find((section) => section.type === 'label-marquee');
    const externalVideoSection = fixtureSections.find((section) => section.type === 'external-video');
    const columnsSection = fixtureSections.find((section) => section.type === 'columns');

    expect(blockViewCalls.get('rich-text')).toEqual([
      {
        sectionId: richTextSection?.id,
        props: richTextSection?.props ?? {},
        content: richTextSection?.content,
        columns: undefined,
      },
      {
        sectionId: columnsSection?.columns?.[0]?.sections[0]?.id,
        props: columnsSection?.columns?.[0]?.sections[0]?.props ?? {},
        content: columnsSection?.columns?.[0]?.sections[0]?.content,
        columns: undefined,
      },
    ]);
    expect(blockViewCalls.get('post-list')).toEqual([
      {
        sectionId: postListSection?.id,
        props: postListSection?.props ?? {},
        content: undefined,
        columns: undefined,
      },
    ]);
    expect(blockViewCalls.get('post-table')).toEqual([
      {
        sectionId: postTableSection?.id,
        props: postTableSection?.props ?? {},
        content: undefined,
        columns: undefined,
      },
    ]);
    expect(blockViewCalls.get('post-map')).toEqual([
      {
        sectionId: postMapSection?.id,
        props: postMapSection?.props ?? {},
        content: undefined,
        columns: undefined,
      },
    ]);
    expect(blockViewCalls.get('work-map')).toEqual([
      {
        sectionId: workMapSection?.id,
        props: workMapSection?.props ?? {},
        content: undefined,
        columns: undefined,
      },
    ]);
    expect(blockViewCalls.get('work-table')).toEqual([
      {
        sectionId: workTableSection?.id,
        props: workTableSection?.props ?? {},
        content: undefined,
        columns: undefined,
      },
    ]);
    expect(blockViewCalls.get('author-list')).toEqual([
      {
        sectionId: authorListSection?.id,
        props: authorListSection?.props ?? {},
        content: undefined,
        columns: undefined,
      },
    ]);
    expect(blockViewCalls.get('work-list')).toEqual([
      {
        sectionId: workListSection?.id,
        props: workListSection?.props ?? {},
        content: undefined,
        columns: undefined,
      },
    ]);
    expect(blockViewCalls.get('program-event-list')).toEqual([
      {
        sectionId: programEventListSection?.id,
        props: programEventListSection?.props ?? {},
        content: undefined,
        columns: undefined,
      },
    ]);
    expect(blockViewCalls.get('release-list')).toEqual([
      {
        sectionId: releaseListSection?.id,
        props: releaseListSection?.props ?? {},
        content: undefined,
        columns: undefined,
      },
    ]);
    expect(blockViewCalls.get('artist-list')).toEqual([
      {
        sectionId: artistListSection?.id,
        props: artistListSection?.props ?? {},
        content: undefined,
        columns: undefined,
      },
    ]);
    expect(blockViewCalls.get('label-list')).toEqual([
      {
        sectionId: labelListSection?.id,
        props: labelListSection?.props ?? {},
        content: undefined,
        columns: undefined,
      },
    ]);
    expect(blockViewCalls.get('form')).toEqual([
      {
        sectionId: formSection?.id,
        props: formSection?.props ?? {},
        content: undefined,
        columns: undefined,
      },
    ]);
    expect(blockViewCalls.get('map')).toEqual([
      {
        sectionId: mapSection?.id,
        props: mapSection?.props ?? {},
        content: undefined,
        columns: undefined,
      },
    ]);
    expect(blockViewCalls.get('immersive-scene')).toEqual([
      {
        sectionId: immersiveSceneSection?.id,
        props: immersiveSceneSection?.props ?? {},
        content: undefined,
        columns: undefined,
      },
    ]);
    expect(blockViewCalls.get('text-marquee')).toEqual([
      {
        sectionId: textMarqueeSection?.id,
        props: textMarqueeSection?.props ?? {},
        content: undefined,
        columns: undefined,
      },
    ]);
    expect(blockViewCalls.get('client-marquee')).toEqual([
      {
        sectionId: clientMarqueeSection?.id,
        props: clientMarqueeSection?.props ?? {},
        content: undefined,
        columns: undefined,
      },
    ]);
    expect(blockViewCalls.get('label-marquee')).toEqual([
      {
        sectionId: labelMarqueeSection?.id,
        props: labelMarqueeSection?.props ?? {},
        content: undefined,
        columns: undefined,
      },
    ]);
    expect(blockViewCalls.get('external-video')).toEqual([
      {
        sectionId: externalVideoSection?.id,
        props: externalVideoSection?.props ?? {},
        content: undefined,
        columns: undefined,
      },
      {
        sectionId: columnsSection?.columns?.[1]?.sections[0]?.id,
        props: columnsSection?.columns?.[1]?.sections[0]?.props ?? {},
        content: undefined,
        columns: undefined,
      },
    ]);
  });

  it('drops duplicate column or section ids at view time', () => {
    const duplicateSection = {
      id: 'duplicate-child',
      type: 'rich-text' as const,
      settings: {},
      props: {},
      content: [],
    };
    const content: PageContent = {
      sections: [
        {
          id: 'columns-root',
          type: 'columns' as const,
          settings: {},
          props: { columnRatios: '1:1', gap: '24' },
          columns: [
            {
              id: 'duplicate-column',
              sections: [duplicateSection],
            },
            {
              id: 'duplicate-column',
              sections: [duplicateSection],
            },
          ],
        },
      ],
    };

    renderToStaticMarkup(<PageRenderer content={content} query={{}} />);

    expect(blockViewCalls.get('rich-text')).toEqual([
      {
        sectionId: 'duplicate-child',
        props: {},
        content: [],
        columns: undefined,
      },
    ]);
  });

  it('renders immersive sections without classifying page layout', () => {
    const content: PageContent = {
      sections: [
        {
          id: 'scene-1',
          type: 'immersive-scene' as const,
          settings: {},
          props: {
            unitsJson: '[{"id":"single","mesh":"sphere","color":"#ffffff"}]',
            copyJson: '[{"id":"single","title":"Single","text":"Static copy"}]',
          },
        },
      ],
    };

    const html = renderToStaticMarkup(<PageRenderer content={content} query={{}} />);

    expect(html).not.toContain('data-viewport-fit-scene');
    expect(html).not.toContain('data-fit-available-height');
    expect(blockViewCalls.get('immersive-scene')).toEqual([
      {
        sectionId: 'scene-1',
        props: content.sections[0]?.props,
        content: undefined,
        columns: undefined,
      },
    ]);
  });
});
