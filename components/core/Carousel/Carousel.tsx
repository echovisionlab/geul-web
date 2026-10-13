'use client';
import type { ClosedVisualProps } from '../visual-contract';
import { Children, useCallback, useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { useLocale } from 'react-aria';
import { Group as AriaGroup } from 'react-aria-components';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { IconButton } from '../IconButton';
import { LayoutInline } from '../Layout';
import { spaceValue, type Responsive, type Space } from '../Layout/layout-contract';
import classes from './Carousel.module.css';
export type CarouselSlideSize = '100%' | '50%' | '33.333%' | '25%';
export interface CarouselProps extends ClosedVisualProps {
  children: ReactNode;
  slideSize?: Responsive<CarouselSlideSize>;
  slideGap?: Space;
  loop?: boolean;
  withIndicators?: boolean;
  withControls?: boolean;
  labels: { region: string; previous: string; next: string; slide: (page: number) => string };
}
const sizes = new Set(['100%', '50%', '33.333%', '25%']);
export function Carousel({
  children,
  slideSize = '100%',
  slideGap = 'md',
  loop = false,
  withIndicators = false,
  withControls = true,
  labels,
}: CarouselProps) {
  const { direction } = useLocale();
  const viewportId = useId();
  const [visibleSlides, setVisibleSlides] = useState<readonly number[] | null>(null);
  const [viewport, api] = useEmblaCarousel({ loop, align: 'start', direction });
  const [selected, setSelected] = useState(0),
    [snaps, setSnaps] = useState<number[]>([]),
    [previous, setPrevious] = useState(false),
    [next, setNext] = useState(false);
  const sync = useCallback(() => {
    if (api) {
      setSelected(api.selectedScrollSnap());
      setSnaps(api.scrollSnapList());
      setPrevious(api.canScrollPrev());
      setNext(api.canScrollNext());
      const visible = api.slidesInView();
      const focusedSlide = api.slideNodes().findIndex((slide) => slide.contains(document.activeElement));
      if (focusedSlide >= 0 && !visible.includes(focusedSlide)) {
        api.rootNode().focus({ preventScroll: true });
      }
      setVisibleSlides(visible);
    }
  }, [api]);
  useEffect(() => {
    if (!api) {
      return;
    }
    sync();
    api.on('select', sync).on('reInit', sync).on('slidesInView', sync);
    return () => {
      api.off('select', sync).off('reInit', sync).off('slidesInView', sync);
    };
  }, [api, sync]);
  const values = typeof slideSize === 'string' ? { base: slideSize } : slideSize;
  let current: CarouselSlideSize = '100%';
  const style: Record<string, string> = { '--_carousel-gap': spaceValue(slideGap) };
  for (const point of ['base', 'xs', 'sm', 'md', 'lg', 'xl'] as const) {
    const value: CarouselSlideSize = values[point] ?? current;
    if (!sizes.has(value)) {
      throw new Error('Carousel slideSize must use a named content column fraction.');
    }
    current = value;
    style[`--_carousel-slide-${point}`] = value;
    style[`--_carousel-gap-share-${point}`] = String(1 - parseFloat(value) / 100);
  }
  const slides = Children.toArray(children);
  return (
    <section
      data-geul-carousel
      className={classes.root}
      aria-label={labels.region}
      aria-roledescription="carousel"
      style={style as CSSProperties}
    >
      <AriaGroup
        ref={viewport}
        id={viewportId}
        className={classes.viewport}
        role="group"
        aria-label={labels.region}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.currentTarget !== event.target) {
            return;
          }
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            direction === 'rtl' ? api?.scrollPrev() : api?.scrollNext();
          }
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            direction === 'rtl' ? api?.scrollNext() : api?.scrollPrev();
          }
        }}
      >
        <div className={classes.track} aria-live="polite" aria-atomic="false">
          {slides.map((slide, index) => (
            <div
              className={classes.slide}
              key={(slide as { key?: string }).key ?? index}
              role="group"
              data-geul-carousel-slide
              aria-roledescription="slide"
              aria-label={labels.slide(index + 1)}
              aria-hidden={visibleSlides !== null && !visibleSlides.includes(index) ? true : undefined}
              inert={visibleSlides !== null && !visibleSlides.includes(index) ? true : undefined}
            >
              {slide}
            </div>
          ))}
        </div>
      </AriaGroup>
      {withControls || withIndicators ? (
        <div className={classes.footer}>
          <LayoutInline gap="xs" justify="center" wrap="wrap">
            {withControls ? (
              <IconButton
                aria-controls={viewportId}
                label={labels.previous}
                size="xs"
                disabled={!previous}
                onClick={() => api?.scrollPrev()}
              >
                {direction === 'rtl' ? <IconChevronRight size="1em" /> : <IconChevronLeft size="1em" />}
              </IconButton>
            ) : null}
            {withIndicators
              ? snaps.map((_, index) => (
                  <IconButton
                    key={index}
                    label={labels.slide(index + 1)}
                    size="xs"
                    emphasis={selected === index ? 'medium' : 'low'}
                    aria-controls={viewportId}
                    aria-current={selected === index ? 'true' : undefined}
                    onClick={() => api?.scrollTo(index)}
                  >
                    <span className={classes.indicator} aria-hidden />
                  </IconButton>
                ))
              : null}
            {withControls ? (
              <IconButton
                aria-controls={viewportId}
                label={labels.next}
                size="xs"
                disabled={!next}
                onClick={() => api?.scrollNext()}
              >
                {direction === 'rtl' ? <IconChevronLeft size="1em" /> : <IconChevronRight size="1em" />}
              </IconButton>
            ) : null}
          </LayoutInline>
        </div>
      ) : null}
    </section>
  );
}
