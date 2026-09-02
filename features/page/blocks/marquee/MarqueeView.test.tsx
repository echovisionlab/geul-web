// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { MarqueeView } from './MarqueeView';
import {
  MARQUEE_DEFAULT_ITEM_HEIGHT,
  MARQUEE_DEFAULT_SPEED,
  MARQUEE_MAX_RENDERED_ITEMS_PER_LANE,
  resolveMarqueeDurationSeconds,
  resolveMarqueeGroupRepeatCount,
  resolveMarqueeItemHeightPx,
  resolveMarqueeSpeedPxPerSecond,
  resolveMarqueeTextSizePx,
} from './metrics';

const baseOptions = {
  direction: 'left',
  speed: 'normal',
  itemHeight: 'md',
  gap: 'lg',
  pauseOnHover: true,
  linkTarget: 'same-tab',
  logoScale: 'contain',
  fallbackMode: 'name',
} as const;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

function renderMarqueeView(items: Parameters<typeof MarqueeView>[0]['items']) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <MantineProvider>
        <MarqueeView items={items} options={baseOptions} />
      </MantineProvider>,
    );
  });
}

function setLoadedImageMetrics(image: HTMLImageElement, rect: Pick<DOMRect, 'width' | 'height'>) {
  Object.defineProperty(image, 'naturalWidth', {
    configurable: true,
    value: 150,
  });
  Object.defineProperty(image, 'naturalHeight', {
    configurable: true,
    value: 150,
  });
  image.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      top: 0,
      right: rect.width,
      bottom: rect.height,
      left: 0,
      width: rect.width,
      height: rect.height,
      toJSON: () => ({}),
    }) as DOMRect;
}

function setElementRect(element: Element, rect: Pick<DOMRect, 'width' | 'height'>) {
  element.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      top: 0,
      right: rect.width,
      bottom: rect.height,
      left: 0,
      width: rect.width,
      height: rect.height,
      toJSON: () => ({}),
    }) as DOMRect;
}

describe('MarqueeView', () => {
  it('marks the marquee as a full-width page block', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <MarqueeView items={[{ id: 'text-1', text: 'Full width item' }]} options={baseOptions} />
      </MantineProvider>,
    );

    expect(html).toContain('class="');
    expect(html).toContain('marquee-block');
    expect(html).toContain('data-block-type="marquee"');
  });

  it('applies render variants through data attributes and CSS variables', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <MarqueeView
          items={[{ id: 'text-1', text: 'Variant item' }]}
          options={{
            ...baseOptions,
            direction: 'right',
            pauseOnHover: false,
            logoScale: 'fill-height',
            gap: 'sm',
            itemHeightPx: 22,
            speedPxPerSecond: 8,
          }}
        />
      </MantineProvider>,
    );

    expect(html).toContain('data-direction="right"');
    expect(html).toContain('data-pause-on-hover="false"');
    expect(html).toContain('data-logo-scale="fill-height"');
    expect(html).toContain('--marquee-gap:16px');
    expect(html).toContain('--marquee-item-height:22px');
    expect(html).toContain('--marquee-text-size:14px');
  });

  it('bounds lane group repetition for sparse items without unbounded item cloning', () => {
    expect(resolveMarqueeGroupRepeatCount(1200, 120, 1)).toBe(20);
    expect(resolveMarqueeGroupRepeatCount(1200, 0, 1)).toBe(1);
    expect(resolveMarqueeGroupRepeatCount(1200, 1, 1)).toBe(MARQUEE_MAX_RENDERED_ITEMS_PER_LANE);
    expect(resolveMarqueeGroupRepeatCount(1200, 1, 32)).toBe(4);
  });

  it('resolves numeric speed and height controls with legacy fallbacks', () => {
    expect(resolveMarqueeSpeedPxPerSecond(undefined, 'normal')).toBe(MARQUEE_DEFAULT_SPEED);
    expect(resolveMarqueeSpeedPxPerSecond('200', 'normal')).toBe(36);
    expect(resolveMarqueeSpeedPxPerSecond('2', 'normal')).toBe(4);
    expect(resolveMarqueeItemHeightPx(undefined, 'md')).toBe(MARQUEE_DEFAULT_ITEM_HEIGHT);
    expect(resolveMarqueeItemHeightPx('100', 'md')).toBe(56);
    expect(resolveMarqueeItemHeightPx('10', 'md')).toBe(16);
  });

  it('derives animation duration from measured lane width and speed', () => {
    expect(resolveMarqueeDurationSeconds(2400, 12)).toBe(200);
    expect(resolveMarqueeTextSizePx(28)).toBe(14);
  });

  it('renders text-only items without link affordance when href is absent', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <MarqueeView items={[{ id: 'text-1', text: 'No link item' }]} options={baseOptions} />
      </MantineProvider>,
    );

    expect(html).toContain('No link item');
    expect(html).not.toContain('<a ');
  });

  it('renders entity links with marquee-level target policy', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <MarqueeView
          items={[
            {
              id: 'client-1',
              text: 'Client',
              href: 'https://client.example.com',
              logoLightUrl: 'https://cdn.example.com/client-light.svg',
            },
          ]}
          options={{ ...baseOptions, linkTarget: 'new-tab' }}
        />
      </MantineProvider>,
    );

    expect(html).toContain('href="https://client.example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
    expect(html).toContain('alt="Client"');
  });

  it('adds a size fallback only when a loaded logo collapses to zero dimensions', () => {
    renderMarqueeView([
      {
        id: 'client-1',
        text: 'Collapsed SVG logo',
        logoLightUrl: 'https://cdn.example.com/collapsed.svg',
      },
      {
        id: 'client-2',
        text: 'Normal logo',
        logoLightUrl: 'https://cdn.example.com/normal.svg',
      },
    ]);

    const collapsedLogo = document.querySelector('img[alt="Collapsed SVG logo"]') as HTMLImageElement | null;
    const normalLogo = document.querySelector('img[alt="Normal logo"]') as HTMLImageElement | null;

    expect(collapsedLogo).not.toBeNull();
    expect(normalLogo).not.toBeNull();

    setLoadedImageMetrics(collapsedLogo!, { width: 0, height: 0 });
    setLoadedImageMetrics(normalLogo!, { width: 80, height: 24 });
    setElementRect(normalLogo!.parentElement!, { width: 80, height: 24 });

    act(() => {
      collapsedLogo!.dispatchEvent(new Event('load'));
      normalLogo!.dispatchEvent(new Event('load'));
    });

    expect(collapsedLogo!.getAttribute('data-size-fallback')).toBe('true');
    expect(normalLogo!.hasAttribute('data-size-fallback')).toBe(false);
  });

  it('adds a size fallback when Safari collapses the parent flex item width', () => {
    renderMarqueeView([
      {
        id: 'client-1',
        text: 'Safari collapsed item',
        logoLightUrl: 'https://cdn.example.com/safari.svg',
      },
    ]);

    const logo = document.querySelector('img[alt="Safari collapsed item"]') as HTMLImageElement | null;

    expect(logo).not.toBeNull();

    setLoadedImageMetrics(logo!, { width: 120, height: 28 });
    setElementRect(logo!.parentElement!, { width: 0, height: 28 });

    act(() => {
      logo!.dispatchEvent(new Event('load'));
    });

    expect(logo!.getAttribute('data-size-fallback')).toBe('true');
  });

  it('hides missing-logo items when configured to require logos', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <MarqueeView
          items={[{ id: 'client-1', text: 'Missing logo' }]}
          options={{ ...baseOptions, fallbackMode: 'hide' }}
          emptyLabel="No marquee items"
        />
      </MantineProvider>,
    );

    expect(html).toContain('No marquee items');
    expect(html).not.toContain('Missing logo');
  });
});
