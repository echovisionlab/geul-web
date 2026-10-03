// @vitest-environment jsdom

import { renderToReadableStream } from 'react-dom/server.browser';
import { describe, expect, it, vi } from 'vitest';
import type { CarouselProps } from '@mantine/carousel';
import { TestProviders } from '@/test/TestProviders';
import { ListViewShell } from './ListViewShell';

const probes = vi.hoisted(() => ({
  carouselImports: 0,
  options: [] as Array<{ ssr?: boolean } | undefined>,
  received: [] as CarouselProps[],
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
  probes.carouselImports += 1;
  const actual = await vi.importActual<typeof import('@mantine/carousel')>('@mantine/carousel');
  const Carousel = Object.assign(
    (props: CarouselProps) => {
      probes.received.push(props);
      return <actual.Carousel {...props} />;
    },
    { Slide: actual.Carousel.Slide },
  );
  return { ...actual, Carousel };
});

const items = [
  { id: 'first', href: '/first', title: 'First', imageUrl: 'https://example.com/first.svg' },
  { id: 'second', href: '/second', title: 'Second', imageUrl: null },
];

async function renderShell(layout: 'grid' | 'carousel', columns: number) {
  const stream = await renderToReadableStream(
    <TestProviders>
      <ListViewShell
        items={items}
        className="public-list"
        emptyLabel="Empty"
        layout={layout}
        columns={columns}
        showImage
        carouselLoop
        carouselIndicators
        renderHeroMeta={(item) => <span data-meta={item.id}>Hero metadata</span>}
        renderCarouselCardMeta={(item) => <span data-meta={item.id}>Card metadata</span>}
      />
    </TestProviders>,
  );
  await stream.allReady;
  const host = document.createElement('div');
  host.innerHTML = await new Response(stream).text();
  return host;
}

describe('list carousel runtime boundary', () => {
  it('keeps grid free of carousel imports and preserves real hero/card carousel SSR slides', async () => {
    expect(probes.carouselImports).toBe(0);
    expect(probes.options.every((options) => options?.ssr !== false)).toBe(true);
    const grid = await renderShell('grid', 3);
    expect(grid.textContent).toContain('First');
    expect(grid.querySelector('.mantine-Carousel-root')).toBeNull();
    expect(probes.carouselImports).toBe(0);

    const hero = await renderShell('carousel', 1);
    expect(probes.carouselImports).toBe(1);
    const slides = hero.querySelectorAll('.mantine-Carousel-slide');
    expect(slides).toHaveLength(2);
    expect(hero.querySelectorAll('.mantine-Carousel-slide .mantine-Carousel-slide')).toHaveLength(0);
    expect(slides[0].querySelectorAll('[data-hero-carousel-slide]')).toHaveLength(1);
    expect(slides[0].querySelector('a[href="/first"]')).not.toBeNull();
    expect(slides[0].querySelector('[data-meta="first"]')?.textContent).toBe('Hero metadata');
    expect((slides[0].querySelector('img') as HTMLImageElement).style.objectFit).toBe('contain');
    expect(hero.querySelectorAll('.mantine-Carousel-control')).toHaveLength(2);
    // Embla discovers slide count after mount; SSR has controls but no dots yet.
    expect(probes.received.at(-1)).toEqual(
      expect.objectContaining({
        withIndicators: true,
        withControls: true,
        slideSize: '100%',
        emblaOptions: { loop: true },
      }),
    );

    const cards = await renderShell('carousel', 3);
    expect(cards.querySelectorAll('.mantine-Carousel-slide')).toHaveLength(2);
    expect(cards.querySelector('[data-meta="first"]')?.textContent).toBe('Card metadata');
    expect(cards.querySelector('a[href="/first"]')).not.toBeNull();
    expect(probes.carouselImports).toBe(1);
  });
});
