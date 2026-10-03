// @vitest-environment jsdom

import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToReadableStream } from 'react-dom/server.browser';
import type { CarouselProps } from '@mantine/carousel';
import { describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { ListBlockSkeleton } from './ListBlockSkeleton';
import { PostListSkeleton } from './post-list/Skeleton';
import { PostListView } from './post-list/View';

const probes = vi.hoisted(() => ({
  imports: 0,
  options: [] as Array<{ ssr?: boolean } | undefined>,
  carousels: [] as CarouselProps[],
  query: vi.fn((_options: unknown) => ({ isLoading: true, data: undefined })),
  listPosts: vi.fn(),
}));

vi.mock('next/dynamic', async () => {
  const { default: dynamic } = await vi.importActual<{ default: typeof import('next/dynamic').default }>(
    'next/dist/shared/lib/app-dynamic.js',
  );
  return {
    default: (...args: Parameters<typeof dynamic>) => {
      probes.options.push(args[1]);
      return dynamic(...args);
    },
  };
});

vi.mock('@mantine/carousel', async () => {
  probes.imports += 1;
  const actual = await vi.importActual<typeof import('@mantine/carousel')>('@mantine/carousel');
  const Carousel = Object.assign(
    (props: CarouselProps) => {
      probes.carousels.push(props);
      return <actual.Carousel {...props} />;
    },
    { Slide: actual.Carousel.Slide },
  );
  return { ...actual, Carousel };
});

vi.mock('@tanstack/react-query', async () => ({
  ...(await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')),
  useQuery: probes.query,
}));
vi.mock('@/lib/queries/post-browser', () => ({ listPublishedPosts: probes.listPosts }));

async function renderServer(node: ReactNode) {
  const stream = await renderToReadableStream(<TestProviders>{node}</TestProviders>);
  await stream.allReady;
  const host = document.createElement('div');
  host.innerHTML = await new Response(stream).text();
  return host;
}

function slideKeys(props: CarouselProps) {
  const slides = Children.toArray(props.children) as ReactElement<{ children: ReactElement }>[];
  for (const slide of slides) {
    expect(isValidElement(slide.props.children)).toBe(true);
    expect(slide.key).toContain(String(slide.props.children.key));
  }
  const keys = slides.map((slide) => slide.key);
  expect(new Set(keys).size).toBe(keys.length);
  return keys;
}

describe('carousel skeleton runtime boundaries', () => {
  it('keeps non-carousel skeletons free of Carousel and preserves real streamed carousel slides and settings', async () => {
    expect(probes.imports).toBe(0);
    expect(probes.options.every((options) => options?.ssr !== false)).toBe(true);

    for (const layout of ['grid', 'minimal', 'list', 'cards']) {
      const grid = await renderServer(<ListBlockSkeleton className="public-list" layout={layout} limit={3} />);
      expect(grid.querySelector('.public-list')).not.toBeNull();
      expect(grid.querySelector('.mantine-Carousel-root')).toBeNull();
      expect(grid.querySelectorAll('.mantine-Skeleton-root')).toHaveLength(layout === 'minimal' ? 6 : 9);
    }
    for (const node of [<PostListSkeleton limit={3} />, <PostListView props={{ limit: '3' }} />]) {
      const grid = await renderServer(node);
      expect(grid.querySelector('.mantine-Carousel-root')).toBeNull();
      expect(grid.querySelectorAll('.mantine-Skeleton-root')).toHaveLength(9);
    }
    expect(probes.imports).toBe(0);

    const common = { layout: 'carousel', limit: 3, columns: 2, carouselLoop: false, carouselIndicators: false };
    const cases = [
      { node: <ListBlockSkeleton className="public-list" {...common} />, gap: 'lg', className: 'public-list' },
      { node: <PostListSkeleton {...common} />, gap: 'md', className: 'post-list-block' },
      {
        node: (
          <PostListView
            props={{
              layout: 'carousel',
              limit: '3',
              columns: '2',
              carouselLoop: 'false',
              carouselIndicators: 'false',
              showPagination: 'true',
              categoryIds: 'first,second',
            }}
          />
        ),
        gap: 'md',
        className: 'post-list-block',
      },
    ];
    let keys: ReturnType<typeof slideKeys> | undefined;
    for (const { node, gap, className } of cases) {
      const carousel = await renderServer(node);
      expect(carousel.querySelectorAll('.mantine-Carousel-slide')).toHaveLength(3);
      expect(carousel.querySelectorAll('.mantine-Carousel-slide .mantine-Carousel-slide')).toHaveLength(0);
      expect(carousel.querySelectorAll('.mantine-Skeleton-root')).toHaveLength(9);
      const received = probes.carousels.at(-1)!;
      expect(received).toEqual(
        expect.objectContaining({
          slideSize: { base: '100%', sm: '50%', md: '50%' },
          slideGap: gap,
          emblaOptions: { loop: false },
          withIndicators: false,
          className,
        }),
      );
      const currentKeys = slideKeys(received);
      if (keys) {
        expect(currentKeys).toEqual(keys);
      }
      keys = currentKeys;
    }
    expect(probes.imports).toBe(1);
    const query = probes.query.mock.calls.at(-1)![0] as { queryKey: unknown[]; queryFn: () => unknown };
    expect(query.queryKey).toEqual([
      'posts',
      'published',
      expect.objectContaining({
        categoryIds: ['first', 'second'],
        limit: 3,
        page: 1,
        showPagination: true,
      }),
    ]);
    await query.queryFn();
    expect(probes.listPosts).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryIds: ['first', 'second'],
        limit: 3,
        offset: 0,
      }),
    );
  });
});
