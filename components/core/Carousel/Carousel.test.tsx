// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from 'react-aria-components';
import { Carousel } from './Carousel';

const state = vi.hoisted(() => ({
  visible: [0],
  selected: 0,
  handlers: new Map<string, () => void>(),
  host: null as HTMLDivElement | null,
}));
const api = vi.hoisted(() => ({
  selectedScrollSnap: () => state.selected,
  scrollSnapList: () => [0, 1, 2],
  canScrollPrev: () => state.selected > 0,
  canScrollNext: () => state.selected < 2,
  slidesInView: () => state.visible,
  slideNodes: () => Array.from(state.host!.querySelectorAll<HTMLElement>('[data-geul-carousel-slide]')),
  rootNode: () => state.host!.querySelector<HTMLElement>('[role="group"][tabindex="0"]')!,
  on: (event: string, handler: () => void) => {
    state.handlers.set(event, handler);
    return api;
  },
  off: (event: string) => {
    state.handlers.delete(event);
    return api;
  },
  scrollNext: vi.fn(),
  scrollPrev: vi.fn(),
  scrollTo: vi.fn(),
}));
vi.mock('embla-carousel-react', () => ({ default: () => [vi.fn(), api] }));
let root: Root;
beforeEach(() => {
  state.visible = [0];
  state.selected = 0;
  state.handlers.clear();
  state.host = document.createElement('div');
  document.body.append(state.host);
  root = createRoot(state.host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  state.host!.remove();
  vi.clearAllMocks();
});
async function render(locale = 'en-US') {
  await act(async () =>
    root.render(
      <I18nProvider locale={locale}>
        <Carousel
          withIndicators
          labels={{ region: 'Photos', previous: 'Previous', next: 'Next', slide: (number) => `Photo ${number}` }}
        >
          <a href="/first">First photo</a>
          <button type="button">Second photo</button>
          <a href="/third">Third photo</a>
        </Carousel>
      </I18nProvider>,
    ),
  );
}
describe('Carousel accessible slide transitions', () => {
  it('keeps offscreen slide contents mounted but inert and hidden to assistive technology', async () => {
    await render();
    const slides = state.host!.querySelectorAll<HTMLElement>('[data-geul-carousel-slide]');
    expect(slides[0].hasAttribute('inert')).toBe(false);
    expect(slides[1].getAttribute('aria-hidden')).toBe('true');
    expect(slides[1].hasAttribute('inert')).toBe(true);
    await act(async () => {
      state.selected = 1;
      state.visible = [1, 2];
      state.handlers.get('slidesInView')!();
    });
    expect(slides[0].hasAttribute('inert')).toBe(true);
    expect(slides[1].hasAttribute('inert')).toBe(false);
    expect(slides[2].hasAttribute('inert')).toBe(false);
    const selected = state.host!.querySelector('[aria-current="true"]')!;
    expect(selected.getAttribute('aria-label')).toBe('Photo 2');
    expect(document.getElementById(selected.getAttribute('aria-controls')!)).not.toBeNull();
  });
  it('returns focus to the carousel viewport only when its focused slide leaves view', async () => {
    await render();
    await act(async () => state.host!.querySelector<HTMLAnchorElement>('a')!.focus());
    await act(async () => {
      state.selected = 1;
      state.visible = [1];
      state.handlers.get('select')!();
    });
    expect(document.activeElement).toBe(api.rootNode());
    const next = state.host!.querySelector<HTMLButtonElement>('[aria-label="Next"]')!;
    await act(async () => next.focus());
    await act(async () => {
      state.selected = 2;
      state.visible = [2];
      state.handlers.get('select')!();
    });
    expect(document.activeElement).toBe(next);
  });
  it('supports viewport arrow navigation in RTL without intercepting child control keys', async () => {
    await render('ar');
    await act(async () =>
      api.rootNode().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })),
    );
    expect(api.scrollPrev).toHaveBeenCalledOnce();
    await act(async () =>
      state.host!.querySelector('a')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })),
    );
    expect(api.scrollPrev).toHaveBeenCalledOnce();
  });
});
