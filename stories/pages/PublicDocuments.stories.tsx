import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, waitFor, within } from 'storybook/test';
import { useState } from 'react';
import { useLocale } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fromJson } from '@bufbuild/protobuf';
import { PostStatus } from '@echovisionlab/geul-proto/public/post_pb.ts';
import {
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import { materializeLocalizedRichTextTree } from '@/features/editor/contract/localized-rich-text';
import { DEFAULT_DOCUMENT_LAYOUT } from '@/features/document-layout';
import { PostViewContent } from '@/features/post/PostViewContent';
import { PageContentView } from '@/features/page/PageView/PageContentView';
import { actionSuccess } from '@/lib/actions/action-result';
import { PublicShellStoryHarness } from '@/stories/public/fixtures/PublicShellStoryHarness';
import { assertDocumentOutline } from '@/stories/public/fixtures/document-outline';
import {
  buildLongRichText,
  localizeLongSections,
  longRichTextLocale,
  NESTED_LONG_SECTIONS,
  UNTITLED_LONG_SECTIONS,
  type LongRichTextLocale,
} from '@/stories/public/fixtures/long-rich-text';
const content = materializeLocalizedRichTextTree(
  fromJson(LocalizedRichTextDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile: RichTextProfile.POST,
    locale: 'en',
    base: {
      nodes: [
        {
          block: { id: '10000000-0000-4000-8000-000000000101', heading: { props: { level: 1 } } },
          placement: { index: 0 },
        },
        { block: { id: '10000000-0000-4000-8000-000000000102', paragraph: { props: {} } }, placement: { index: 1 } },
      ],
    },
    localeOverlay: {
      locale: 'en',
      blocks: [
        {
          blockId: '10000000-0000-4000-8000-000000000101',
          heading: { props: {}, content: [{ text: { text: 'Listening notes' } }] },
        },
        {
          blockId: '10000000-0000-4000-8000-000000000102',
          paragraph: { props: {}, content: [{ text: { text: 'A small room, a quiet signal, and time to listen.' } }] },
        },
      ],
    },
  }),
);
/**
 * Long documents per review content language (Storybook locale `ko` → Hangul, `ar` → Arabic, else
 * English). Without a visible page title the authored body supplies the page's h1 (no demotion).
 */
const longDocuments = new Map<LongRichTextLocale, ReturnType<typeof buildLongDocuments>>();
function buildLongDocuments(locale: LongRichTextLocale) {
  return {
    longContent: buildLongRichText(localizeLongSections(NESTED_LONG_SECTIONS, locale), { locale }),
    untitledLongContent: buildLongRichText(localizeLongSections(UNTITLED_LONG_SECTIONS, locale), {
      firstId: 500,
      locale,
    }),
  };
}
function longDocumentsFor(locale: string) {
  const key = longRichTextLocale(locale);
  if (!longDocuments.has(key)) {
    longDocuments.set(key, buildLongDocuments(key));
  }
  return longDocuments.get(key)!;
}
/** Authored h1–h3 under the document title: the hierarchy the shared type scale must keep at every width. */
const hierarchyText = [
  [1, 'Recording the room'],
  [0, 'Every space has a tone before anyone plays a note. Start by listening to it for a full minute.'],
  [2, 'Placing the microphones'],
  [0, 'Move slowly between positions and write down what changes: distance, reflections and floor noise.'],
  [3, 'Near the window'],
  [0, 'Traffic and wind arrive as a low wash; keep the level modest and let the room breathe.'],
] as const;
const hierarchyContent = materializeLocalizedRichTextTree(
  fromJson(LocalizedRichTextDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile: RichTextProfile.POST,
    locale: 'en',
    base: {
      nodes: hierarchyText.map(([level], index) => ({
        block: {
          id: `10000000-0000-4000-8000-0000000003${String(index).padStart(2, '0')}`,
          ...(level ? { heading: { props: { level } } } : { paragraph: { props: {} } }),
        },
        placement: { index },
      })),
    },
    localeOverlay: {
      locale: 'en',
      blocks: hierarchyText.map(([level, text], index) => ({
        blockId: `10000000-0000-4000-8000-0000000003${String(index).padStart(2, '0')}`,
        [level ? 'heading' : 'paragraph']: { props: {}, content: [{ text: { text } }] },
      })),
    },
  }),
);
export function PublicDocumentPagePreview({
  domain = 'post',
  state = 'ready',
  pagePath = '/quiet-studio',
  hideTableOfContents = false,
}: {
  domain?: 'post' | 'page';
  state?:
    | 'ready'
    | 'empty'
    | 'hero'
    | 'hero-long'
    | 'hero-long-document'
    | 'pinned'
    | 'long-document'
    | 'untitled-long-document'
    | 'heading-hierarchy'
    | 'unavailable-language';
  pagePath?: string;
  hideTableOfContents?: boolean;
}) {
  const locale = useLocale();
  const { longContent, untitledLongContent } = longDocumentsFor(locale);
  const [contentLocale, setContentLocale] = useState<string | null>(null);
  const requestedLocale = contentLocale ?? locale;
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }),
  );
  const blocks =
    state === 'empty'
      ? []
      : state === 'untitled-long-document'
        ? untitledLongContent
        : state === 'long-document' || state === 'hero-long-document'
          ? longContent
          : state === 'heading-hierarchy'
            ? hierarchyContent
            : content;
  const isHero = state === 'hero' || state === 'hero-long' || state === 'hero-long-document';
  const longHero = state === 'hero-long' || state === 'hero-long-document';
  const pageLocalization =
    state === 'untitled-long-document'
      ? {
          requestedLocale: locale,
          displayedLocale: locale,
          sourceLocale: 'en',
          isFallback: false,
          isOriginal: locale === 'en',
          machineGenerated: false,
          fallbackReason: 0,
          availableLocales: ['en', 'ko', 'ja'],
        }
      : state === 'unavailable-language'
        ? {
            requestedLocale: 'nl',
            displayedLocale: 'en',
            sourceLocale: 'ko',
            isFallback: true,
            isOriginal: false,
            machineGenerated: false,
            fallbackReason: 2,
            availableLocales: ['ko', 'en', 'ja'],
          }
        : null;
  const layout = {
    ...DEFAULT_DOCUMENT_LAYOUT,
    ...(hideTableOfContents ? { hideTableOfContents: true } : {}),
    ...(state === 'pinned' ? { pageChrome: 'pinned' as const } : {}),
  };
  return (
    <QueryClientProvider client={client}>
      {domain === 'post' ? (
        <PostViewContent
          post={{
            id: 'post-1',
            slug: 'listening-notes',
            title: longHero
              ? 'A long listening journal: field recordings, quiet rooms, and the sounds we notice along the way'
              : 'Listening notes',
            summary: 'Field recording journal',
            content: blocks,
            blockMedia: [],
            documentLayout: layout,
            commentsEnabled: false,
            status: 'published',
            statusCode: PostStatus.PUBLISHED,
            series: {
              title: 'Field journal',
              currentOrder: 2,
              prev: { id: 'prev', slug: 'first-day', title: 'First day' },
              next: { id: 'next', slug: 'quiet-room', title: 'Quiet room' },
            },
            featuredImageUrl: isHero ? '/storybook/media/video-poster.jpg' : null,
            publishedAt: new Date('2026-09-12T10:00:00Z'),
            updatedAt: null,
            authors: longHero
              ? [
                  { id: 'member-1', name: 'June Han', image: null },
                  { id: 'member-2', name: 'Alexandra Field Recorder', image: null },
                ]
              : [{ id: 'member-1', name: 'June Han', image: null }],
            collaborators: [],
            categories: [{ id: 'cat-1', name: 'Listening' }],
            tags: longHero
              ? ['Field recording', 'Listening journals', 'Long-form environmental observations', 'Archival notes'].map(
                  (name, index) => ({ id: `tag-${index + 1}`, name }),
                )
              : [{ id: 'tag-1', name: 'Field recording' }],
            locationPlace: null,
            canEdit: false,
            localizationInfo: isHero
              ? {
                  requestedLocale,
                  displayedLocale: requestedLocale,
                  sourceLocale: 'en',
                  isFallback: false,
                  isOriginal: requestedLocale === 'en',
                  machineGenerated: false,
                  fallbackReason: 0,
                  availableLocales: ['en', 'ko', 'ja'],
                }
              : undefined,
          }}
          pathname="/posts/listening-notes"
          requestedLocale={requestedLocale}
          onRequestedLocaleChange={setContentLocale}
          markdownAction={async () =>
            actionSuccess({
              title: 'Listening notes',
              markdown: '# Listening notes\n\nA small room, a quiet signal, and time to listen.',
            })
          }
          commentBindings={{
            sessionSnapshot: null,
            listAction: async () => ({
              ok: true,
              value: { comments: [], totalCount: 0, hasMore: false, nextCursor: undefined },
            }),
          }}
        />
      ) : (
        <PageContentView
          page={{
            title: pagePath === '/quiet-studio' ? 'Quiet Studio' : pagePath === '/' ? 'Home' : pagePath,
            showTitle: state !== 'empty' && state !== 'untitled-long-document',
            content: [
              {
                id: '10000000-0000-4000-8000-000000000201',
                kind: 'rich-text',
                settings: {},
                props: {},
                richText: blocks,
                columns: [],
              },
            ],
            blockMedia: [],
            documentLayout: layout,
            localizationInfo: pageLocalization,
          }}
          pathname={pagePath}
          requestedLocale={locale}
        />
      )}
    </QueryClientProvider>
  );
}
const meta = {
  title: 'Pages/Public/Documents',
  excludeStories: ['PublicDocumentPagePreview'],
  component: PublicDocumentPagePreview,
  args: { domain: 'post', state: 'ready' },
  render: (args) => <PublicDocumentPagePreview key={`${args.domain}-${args.state}-${args.pagePath}`} {...args} />,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/posts/listening-notes' } },
    docs: {
      description: {
        component:
          'Actual PostViewContent and PageContentView production public document surfaces, with generated typed rich-text fixture, table of contents, real document layout, series links and local markdown export. Hero examples render the featured image, growing title/metadata, and body together without negative-margin bleed. Hero locale selection changes local menu metadata; the authored body remains a fixed fixture. CMS index variants identify the exact route aliases that delegate to the same production page owner: their fixture is a rich-text section, not the live backend-configured entity list. Home demonstrates the resolved CMS-page branch only. Post comments read uses local empty typed response and anonymous snapshot; comment creation/moderation, signed media downloads, service-backed page section kinds, access checks, share tokens and edit branch are outside this preview. Pinned and empty variants use actual layout/document states.',
      },
    },
  },
} satisfies Meta<typeof PublicDocumentPagePreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Post: Story = {};
export const PostLongDocument: Story = {
  args: { state: 'long-document' },
  play: assertDocumentOutline,
  decorators: [
    (Story) => (
      <PublicShellStoryHarness initialPath="/posts/listening-notes">
        <Story />
      </PublicShellStoryHarness>
    ),
  ],
};
export const PostEmpty: Story = { args: { state: 'empty' } };
async function assertHeroReadingLayout({ canvasElement }: { canvasElement: HTMLElement }) {
  const canvas = within(canvasElement);
  await waitFor(() => expect(canvas.getByRole('heading', { level: 1 })).toBeVisible());
  const hero = canvasElement.querySelector<HTMLElement>('[data-post-hero]')!;
  const image = hero.querySelector<HTMLImageElement>('[data-geul-media-image]')!;
  await waitFor(() => expect(image.naturalWidth).toBeGreaterThan(0));
  // The body's first block is the reading column; `.prose` itself spans the breakout width. The body
  // can render after the title and image.
  await waitFor(() => expect(canvasElement.querySelector('.prose > [data-document-block]')).not.toBeNull());
  const body = canvasElement.querySelector<HTMLElement>('.prose > [data-document-block]')!;
  const heading = canvas.getByRole('heading', { level: 1 });
  const heroBounds = hero.getBoundingClientRect();
  const imageBounds = image.getBoundingClientRect();
  const bodyBounds = body.getBoundingClientRect();
  const headingBounds = heading.getBoundingClientRect();
  expect(Math.abs(imageBounds.left - heroBounds.left)).toBeLessThan(1);
  expect(Math.abs(imageBounds.right - heroBounds.right)).toBeLessThan(1);
  expect(headingBounds.bottom).toBeLessThanOrEqual(heroBounds.bottom);
  expect(headingBounds.left).toBeGreaterThanOrEqual(heroBounds.left);
  expect(headingBounds.right).toBeLessThanOrEqual(heroBounds.right);
  // The hero content pads the title onto the reading column; the image-chrome inset is the remainder.
  const heroContent = hero.lastElementChild as HTMLElement;
  const inset = headingBounds.left - heroBounds.left - parseFloat(getComputedStyle(heroContent).paddingInlineStart);
  expect(inset).toBeGreaterThan(0);
  expect(Math.abs(bodyBounds.left - headingBounds.left)).toBeLessThan(1);
  expect(Math.abs(bodyBounds.top - heroBounds.bottom - inset)).toBeLessThan(1);
  expect(canvasElement.ownerDocument.documentElement.scrollWidth).toBeLessThanOrEqual(
    canvasElement.ownerDocument.documentElement.clientWidth,
  );
  expect(body).toBeVisible();
}
export const PostHero: Story = { args: { state: 'hero' }, play: assertHeroReadingLayout };
export const PostHeroLong: Story = { args: { state: 'hero-long' }, play: assertHeroReadingLayout };
export const PostHeroPhone: Story = {
  args: { state: 'hero-long' },
  globals: { viewport: { value: 'phone', isRotated: false } },
  play: assertHeroReadingLayout,
};
export const PostHeroTablet: Story = {
  args: { state: 'hero-long' },
  globals: { viewport: { value: 'tablet', isRotated: false } },
  play: assertHeroReadingLayout,
};
/** Hero + outline: the hero title must share the body's start edge with the outline's reserved space. */
export const PostHeroLongDocument: Story = {
  args: { state: 'hero-long-document' },
  decorators: PostLongDocument.decorators,
  play: async (context) => {
    await assertHeroReadingLayout(context);
    await assertDocumentOutline(context);
  },
};
export const PostPinned: Story = { args: { state: 'pinned' } };
/**
 * The document title stays one clear step above authored h1 > h2 > h3 at the current width. Under the
 * title the authored headings render `h2`–`h4` (one outline level below it) at their authored sizes.
 */
async function assertDocumentHeadingHierarchy(context: { canvasElement: HTMLElement }) {
  const { canvasElement } = context;
  await waitFor(() => expect(canvasElement.querySelector('.prose [data-heading-level="3"]')).toBeVisible());
  const size = (element: Element) => Number.parseFloat(getComputedStyle(element).fontSize);
  const title = canvasElement.querySelector('h1[data-core-typography="heading"]')!;
  const [h1, h2, h3] = [1, 2, 3].map((level) => canvasElement.querySelector(`.prose [data-heading-level="${level}"]`)!);
  expect([h1, h2, h3].map((heading) => heading.tagName)).toEqual(['H2', 'H3', 'H4']);
  const body = canvasElement.querySelector('.prose p')!;
  expect(size(title) / size(h1)).toBeGreaterThanOrEqual(1.125);
  expect(size(h1)).toBeGreaterThan(size(h2));
  expect(size(h2)).toBeGreaterThan(size(h3));
  expect(size(h3)).toBeGreaterThan(size(body));
  await assertDocumentOutline(context);
}
export const PostHeadingHierarchy: Story = {
  args: { state: 'heading-hierarchy' },
  play: assertDocumentHeadingHierarchy,
};
export const PostHeadingHierarchyPhone: Story = {
  args: { state: 'heading-hierarchy' },
  globals: { viewport: { value: 'phone', isRotated: false } },
  play: assertDocumentHeadingHierarchy,
};
export const Page: Story = { args: { domain: 'page' } };
export const PageLongDocument: Story = {
  args: { domain: 'page', state: 'long-document' },
  play: assertDocumentOutline,
  decorators: [
    (Story) => (
      <PublicShellStoryHarness initialPath="/quiet-studio">
        <Story />
      </PublicShellStoryHarness>
    ),
  ],
};
/**
 * No title, a content language menu and an outline: the menu and the outline column share the inline end.
 * Without a title heading the authored levels are the outline: the author's H1 is the page's `h1`.
 */
export const PageLongDocumentUntitled: Story = {
  args: { domain: 'page', state: 'untitled-long-document' },
  decorators: PageLongDocument.decorators,
  play: async (context) => {
    await assertDocumentOutline(context);
    await expect(context.canvasElement.querySelector('h1')).toHaveAttribute('data-heading-level', '1');
  },
};
export const PageHeadingHierarchy: Story = {
  args: { domain: 'page', state: 'heading-hierarchy' },
  play: assertDocumentHeadingHierarchy,
};
/**
 * Dutch was requested and the page has no Dutch version: it is shown in the default language (English)
 * with a notice in the interface language, outside the document's own language, linking to the original.
 */
export const PageUnavailableLanguage: Story = {
  args: { domain: 'page', state: 'unavailable-language' },
  play: async ({ canvasElement }) => {
    const notice = await within(canvasElement).findByText(/Dutch/);
    await expect(notice.closest('[data-content-body]')).toBeNull();
    await expect(canvasElement.querySelector('[data-content-body]')).toHaveAttribute('lang', 'en');
    await expect(canvasElement.querySelector('[data-content-notice] a')).toHaveAttribute(
      'href',
      '/quiet-studio?lang=ko',
    );
  },
};
export const PageEmpty: Story = { args: { domain: 'page', state: 'empty' } };
export const PagePinned: Story = { args: { domain: 'page', state: 'pinned' } };
export const Home: Story = { args: { domain: 'page', pagePath: '/' } };
export const ArtistsIndex: Story = { args: { domain: 'page', pagePath: '/artists' } };
export const LabelsIndex: Story = { args: { domain: 'page', pagePath: '/labels' } };
export const ReleasesIndex: Story = { args: { domain: 'page', pagePath: '/releases' } };
export const WorksIndex: Story = { args: { domain: 'page', pagePath: '/works' } };
export const EventsIndex: Story = { args: { domain: 'page', pagePath: '/events' } };
export const PostsIndex: Story = { args: { domain: 'page', pagePath: '/posts' } };
export const FormsIndex: Story = { args: { domain: 'page', pagePath: '/forms' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };

export const PostWithoutOutline: Story = {
  args: { domain: 'post', state: 'long-document', hideTableOfContents: true },
  decorators: PostLongDocument.decorators,
  play: async (context) => {
    await assertDocumentOutline(context);
    await expect(
      within(context.canvasElement).queryByRole('navigation', { name: /table of contents|목차/i }),
    ).not.toBeInTheDocument();
  },
};
export const PageWithoutOutline: Story = {
  args: { domain: 'page', pagePath: '/quiet-studio', state: 'untitled-long-document', hideTableOfContents: true },
  decorators: PageLongDocument.decorators,
  play: PostWithoutOutline.play,
};
