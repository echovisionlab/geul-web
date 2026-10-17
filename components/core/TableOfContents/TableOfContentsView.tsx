'use client';

import {
  startTransition,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useMediaQuery, useThrottledCallback, useWindowEvent } from '@mantine/hooks';
import { breakpointQuery } from '../Layout/breakpoints';
import { Text } from '../Typography';
import {
  TOC_MAX_VISUAL_DEPTH,
  tocAncestors,
  tocOutline,
  tocRailIndices,
  tocScrubIndex,
  type TocOutlineNode,
} from './toc-rail';
import classes from './TableOfContents.module.css';

export interface TocItem {
  id: string;
  label: string;
  level: number;
}

export interface TableOfContentsViewProps {
  items: TocItem[];
  title: string;
  /**
   * The document the outline navigates. Core reserves the outline's space beside it: a persistent
   * column on wide screens and the quiet, scrubbable rail elsewhere (phones included).
   */
  children: ReactNode;
  /**
   * `center` keeps a centered reading column centered by reserving the same space on both sides;
   * `start` reserves only the inline end (section-based pages whose title and sections start aligned).
   */
  contentPlacement?: 'start' | 'center';
  /**
   * `responsive` (default) shows the persistent column from `lg`. `rail` keeps the rail at every width,
   * for a document that shares the page width with another column (an entity detail's media).
   */
  outlinePresentation?: 'responsive' | 'rail';
}

/** Three or fewer headings do not need navigation. */
export function hasTableOfContents(items: readonly TocItem[]): boolean {
  return items.length > 3;
}

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function scrollToHeading(element: HTMLElement) {
  if (!element.hasAttribute('tabindex')) {
    element.tabIndex = -1;
    element.addEventListener('blur', () => element.removeAttribute('tabindex'), { once: true });
  }
  element.focus({ preventScroll: true });
  element.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

/** Scrolls only the outline (never the page) so `index` is fully visible. */
function revealInList(list: HTMLElement | null, index: number, behavior: ScrollBehavior) {
  const link = list?.querySelector<HTMLElement>(`[data-toc-index="${index}"]`);
  if (!list || !link) {
    return;
  }
  const listBox = list.getBoundingClientRect();
  const linkBox = link.getBoundingClientRect();
  const top = linkBox.top - listBox.top + list.scrollTop;
  const bottom = top + linkBox.height;
  if (top < list.scrollTop) {
    list.scrollTo?.({ top, behavior });
  } else if (bottom > list.scrollTop + list.clientHeight) {
    list.scrollTo?.({ top: bottom - list.clientHeight, behavior });
  }
}

/**
 * Scrolls only the outline so the scrubbed entry sits level with the pointer: the preview stays beside
 * the finger, above the hand, instead of collecting at the list's lower edge.
 */
function alignInList(list: HTMLElement | null, index: number, clientY: number) {
  const link = list?.querySelector<HTMLElement>(`[data-toc-index="${index}"]`);
  if (!list || !link) {
    return;
  }
  const listBox = list.getBoundingClientRect();
  const linkBox = link.getBoundingClientRect();
  const linkCenter = linkBox.top - listBox.top + list.scrollTop + linkBox.height / 2;
  const top = linkCenter - (clientY - listBox.top);
  list.scrollTop = Math.min(Math.max(0, top), Math.max(0, list.scrollHeight - list.clientHeight));
}

interface ScrubState {
  pointerId: number;
  pointerType: string;
  startY: number;
  /** Mouse scrubbing starts after a small drag so a plain click keeps the hover behavior. */
  active: boolean;
  rtl: boolean;
}

/**
 * Reserves an outline beside a document: a persistent column on wide screens and, elsewhere, a quiet
 * rail that reveals one bounded, nonmodal scrolling outline (hover, focus, press or scrub).
 */
export function TableOfContentsView({
  items: sourceItems,
  title,
  children,
  contentPlacement = 'start',
  outlinePresentation = 'responsive',
}: TableOfContentsViewProps) {
  const listId = useId();
  const titleId = useId();
  const wide = Boolean(useMediaQuery(breakpointQuery('lg', 'at-least')));
  const presentation = wide && outlinePresentation === 'responsive' ? 'column' : 'rail';
  const wrapper = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLAnchorElement>(null);
  const marksRef = useRef<HTMLSpanElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const targets = useRef<{ element: HTMLElement; index: number }[]>([]);
  const pointerInside = useRef(false);
  const scrub = useRef<ScrubState | null>(null);
  const scrubIndexRef = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const markerPlaced = useRef(false);
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [scrubIndex, setScrubIndexState] = useState<number | null>(null);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [marker, setMarker] = useState<{ top: number; height: number } | null>(null);
  const open = presentation === 'rail' && (hovered || keyboardOpen || scrubIndex !== null);

  const setScrubIndex = useCallback((index: number | null) => {
    scrubIndexRef.current = index;
    setScrubIndexState(index);
  }, []);

  useEffect(() => {
    setHovered(false);
    setKeyboardOpen(false);
    setActiveIndex(0);
    if (!hasTableOfContents(sourceItems)) {
      setItems([]);
      return;
    }
    let timeout: number | undefined;
    const frame = window.requestAnimationFrame(() => {
      timeout = window.setTimeout(() => startTransition(() => setItems(sourceItems)), 0);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (timeout !== undefined) {
        window.clearTimeout(timeout);
      }
    };
  }, [sourceItems]);

  const updateActiveHeading = useCallback(() => {
    const headings = targets.current;
    if (!headings.length) {
      return;
    }
    // A short final section cannot reach the 100px reading line. At the page
    // boundary its heading must still become current after navigation/scrolling.
    if (window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
      setActiveIndex(headings[headings.length - 1].index);
      return;
    }
    let current = headings[0].index;
    let first = 0;
    let last = headings.length - 1;
    while (first <= last) {
      const middle = Math.floor((first + last) / 2);
      if (headings[middle].element.getBoundingClientRect().top <= 100) {
        current = headings[middle].index;
        first = middle + 1;
      } else {
        last = middle - 1;
      }
    }
    setActiveIndex(current);
  }, []);
  const onDocumentScroll = useThrottledCallback(updateActiveHeading, 100);
  useWindowEvent('scroll', onDocumentScroll, { passive: true });

  const refreshHeadingGeometry = useCallback(() => {
    // Keep outline order authored, but track vertical position correctly when
    // page sections contain side-by-side columns. Measure only on layout changes.
    targets.current = targets.current
      .map((target) => ({ ...target, top: target.element.getBoundingClientRect().top }))
      .sort((left, right) => left.top - right.top || left.index - right.index);
    updateActiveHeading();
    setLayoutVersion((version) => version + 1);
  }, [updateActiveHeading]);
  useWindowEvent('resize', refreshHeadingGeometry);

  useEffect(() => {
    targets.current = items
      .map((item, index) => ({ element: document.getElementById(item.id), index }))
      .filter((entry): entry is { element: HTMLElement; index: number } => entry.element !== null);
    refreshHeadingGeometry();
    const elements = targets.current.map((target) => target.element);
    let ancestor = elements[0]?.parentElement;
    while (ancestor && !elements.every((element) => ancestor!.contains(element))) {
      ancestor = ancestor.parentElement;
    }
    if (!ancestor || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(refreshHeadingGeometry);
    observer.observe(ancestor);
    return () => observer.disconnect();
  }, [items, refreshHeadingGeometry]);

  // The sticky outline is as tall as the viewport below the site header. Until the document has
  // scrolled it to that line it starts lower (below a title or hero), so it also subtracts that
  // distance: the column and the revealed list fit the screen, with their own scroll, from the start.
  // Written as a style property per frame (no re-render); unchanged values are not written.
  const hasOutline = items.length > 0;
  useEffect(() => {
    const element = wrapper.current;
    const track = element?.parentElement;
    if (!element || !track) {
      return;
    }
    let frame = 0;
    let written = '';
    const update = () => {
      frame = 0;
      const stickyTop = Number.parseFloat(getComputedStyle(element).top) || 0;
      const offset = `${Math.max(0, Math.round(track.getBoundingClientRect().top - stickyTop))}px`;
      if (offset !== written) {
        written = offset;
        element.style.setProperty('--_toc-start-offset', offset);
      }
    };
    const schedule = () => {
      frame ||= window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    observer?.observe(document.documentElement);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer?.disconnect();
    };
  }, [hasOutline, presentation]);

  // Match the inspected reference: reopening begins at the first title. Only the
  // outline scrolls; current-section updates never override an open list's position.
  useLayoutEffect(() => {
    if (open && list.current && scrubIndexRef.current === null) {
      list.current.scrollTop = 0;
    }
  }, [open]);

  // Persistent column: one ink marker follows the current entry on the outline's line, and the
  // current entry stays visible in a long outline unless the reader is browsing the column.
  useLayoutEffect(() => {
    if (presentation !== 'column' || !items.length) {
      markerPlaced.current = false;
      setMarker(null);
      return;
    }
    const link = list.current?.querySelector<HTMLElement>(`[data-toc-index="${activeIndex}"]`);
    if (!link || !list.current) {
      return;
    }
    const listBox = list.current.getBoundingClientRect();
    const linkBox = link.getBoundingClientRect();
    setMarker({ top: linkBox.top - listBox.top + list.current.scrollTop, height: linkBox.height });
    const browsing = pointerInside.current || list.current.contains(document.activeElement);
    if (!browsing) {
      revealInList(list.current, activeIndex, markerPlaced.current && !reducedMotion() ? 'smooth' : 'auto');
    }
  }, [activeIndex, items, presentation, layoutVersion]);
  useEffect(() => {
    if (marker) {
      markerPlaced.current = true;
    }
  }, [marker]);

  const outline = useMemo(() => tocOutline(items.map((item) => item.level)), [items]);
  const ancestors = useMemo(() => new Set(tocAncestors(outline.parents, activeIndex)), [outline, activeIndex]);
  const marks = useMemo(() => tocRailIndices(items.length), [items.length]);

  function focusFirst() {
    list.current?.querySelector<HTMLAnchorElement>('a')?.focus({ preventScroll: true });
  }

  function closeOutline() {
    setHovered(false);
    setKeyboardOpen(false);
  }

  function cancelScrub() {
    if (scrub.current && scrub.current.pointerType !== 'mouse') {
      suppressClick.current = true;
    }
    scrub.current = null;
    setScrubIndex(null);
  }

  function handleNavigationKey(event: React.KeyboardEvent<HTMLAnchorElement>) {
    if (event.key === 'Escape' && scrub.current) {
      event.preventDefault();
      cancelScrub();
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      rail.current?.focus({ preventScroll: true });
      closeOutline();
    } else if (presentation === 'rail' && (event.key === 'Tab' || event.key === 'ArrowDown')) {
      setKeyboardOpen(true);
    }
  }

  function navigateTo(index: number, close: boolean) {
    const heading = document.getElementById(items[index].id);
    if (!heading) {
      return;
    }
    setActiveIndex(index);
    if (close) {
      closeOutline();
    }
    scrollToHeading(heading);
  }

  function navigate(event: React.MouseEvent<HTMLAnchorElement>, index: number) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    if (!document.getElementById(items[index].id)) {
      return;
    }
    event.preventDefault();
    navigateTo(index, event.detail === 0);
  }

  function scrubTo(clientY: number) {
    const box = marksRef.current?.getBoundingClientRect();
    if (!box) {
      return;
    }
    const index = tocScrubIndex(clientY, box.top, box.height, items.length);
    if (index !== scrubIndexRef.current) {
      setScrubIndex(index);
    }
    alignInList(list.current, index, clientY);
  }

  // Scrubbing is a pointer enhancement of the rail. Links remain the keyboard/screen-reader path,
  // and nothing is announced while the finger or mouse moves.
  function startScrub(event: React.PointerEvent<HTMLAnchorElement>) {
    suppressClick.current = false;
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    if (event.pointerType !== 'mouse') {
      // No compatibility mouse events, focus-open, text selection or link callout on touch/pen.
      event.preventDefault();
    }
    scrub.current = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startY: event.clientY,
      active: event.pointerType !== 'mouse',
      rtl: getComputedStyle(event.currentTarget).direction === 'rtl',
    };
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // An already-released or synthetic pointer cannot be captured; scrubbing still follows moves on the rail.
    }
    if (scrub.current.active) {
      scrubTo(event.clientY);
    }
  }

  function moveScrub(event: React.PointerEvent<HTMLAnchorElement>) {
    const state = scrub.current;
    if (!state || state.pointerId !== event.pointerId) {
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    const away = state.rtl ? event.clientX - box.right : box.left - event.clientX;
    if (away > box.width * 3) {
      cancelScrub();
      return;
    }
    if (!state.active && Math.abs(event.clientY - state.startY) < 4) {
      return;
    }
    state.active = true;
    scrubTo(event.clientY);
  }

  function endScrub(event: React.PointerEvent<HTMLAnchorElement>) {
    const state = scrub.current;
    if (!state || state.pointerId !== event.pointerId) {
      return;
    }
    scrub.current = null;
    const index = scrubIndexRef.current;
    setScrubIndex(null);
    if (state.active && index !== null) {
      suppressClick.current = true;
      navigateTo(index, state.pointerType !== 'mouse');
    }
  }

  function renderLink(index: number) {
    const item = items[index];
    return (
      <a
        className={classes.link}
        href={`#${item.id}`}
        aria-current={activeIndex === index ? 'location' : undefined}
        data-toc-index={index}
        data-ancestor={ancestors.has(index) || undefined}
        data-scrub-target={scrubIndex === index || undefined}
        style={{ '--_toc-depth': Math.min(TOC_MAX_VISUAL_DEPTH, outline.depths[index]) } as React.CSSProperties}
        onClick={(event) => navigate(event, index)}
        onKeyDown={handleNavigationKey}
      >
        {/* An authored title keeps its own direction (an English title in an RTL interface) while the
            row keeps the interface alignment. */}
        <span className={classes.label}>
          <bdi>{item.label}</bdi>
        </span>
      </a>
    );
  }

  function renderNodes(nodes: TocOutlineNode[]) {
    return nodes.map((node) => (
      <li key={items[node.index].id}>
        {renderLink(node.index)}
        {node.children.length ? <ol className={classes.nested}>{renderNodes(node.children)}</ol> : null}
      </li>
    ));
  }

  const navigation = items.length ? (
    <div
      ref={wrapper}
      role="navigation"
      aria-label={presentation === 'column' ? undefined : title}
      aria-labelledby={presentation === 'column' ? titleId : undefined}
      className={classes.wrapper}
      data-presentation={presentation}
      data-open={open || undefined}
      data-scrubbing={scrubIndex !== null || undefined}
      style={{ '--_toc-mark-count': marks.length } as React.CSSProperties}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'touch') {
          pointerInside.current = true;
          setHovered(true);
        }
      }}
      onPointerLeave={() => {
        pointerInside.current = false;
        setHovered(false);
      }}
      onPointerDown={(event) => {
        if (event.pointerType !== 'touch') {
          setKeyboardOpen(false);
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setKeyboardOpen(false);
        }
      }}
    >
      {presentation === 'column' ? (
        <div className={classes.columnTitle}>
          <Text id={titleId} size="xs" weight="medium" font="mono" tone="secondary">
            {title}
          </Text>
        </div>
      ) : (
        <a
          ref={rail}
          className={classes.rail}
          href={`#${items[activeIndex]?.id}`}
          aria-label={title}
          aria-expanded={open}
          aria-controls={listId}
          // A native link drag would cancel a mouse scrub (pointercancel).
          draggable={false}
          onFocus={() => {
            if (!pointerInside.current && !scrub.current) {
              setKeyboardOpen(true);
            }
          }}
          onClick={(event) => {
            if (suppressClick.current) {
              suppressClick.current = false;
              event.preventDefault();
              return;
            }
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
              return;
            }
            event.preventDefault();
            if (event.detail === 0 || !pointerInside.current) {
              setKeyboardOpen(true);
              focusFirst();
            }
          }}
          onKeyDown={(event) => {
            handleNavigationKey(event);
            if (event.key === 'ArrowDown' && open) {
              event.preventDefault();
              focusFirst();
            }
          }}
          onPointerDown={startScrub}
          onPointerMove={moveScrub}
          onPointerUp={endScrub}
          onPointerCancel={cancelScrub}
          onContextMenu={(event) => {
            if (scrub.current) {
              event.preventDefault();
            }
          }}
        >
          <span ref={marksRef} className={classes.marks} aria-hidden="true">
            {marks.map((index) => (
              <span
                key={index}
                className={classes.mark}
                data-depth={Math.min(TOC_MAX_VISUAL_DEPTH, outline.depths[index])}
              />
            ))}
            <span
              className={classes.currentMark}
              style={{ top: `${((scrubIndex ?? activeIndex) / Math.max(1, items.length - 1)) * 100}%` }}
            />
          </span>
        </a>
      )}
      <ol
        id={presentation === 'rail' ? listId : undefined}
        ref={list}
        className={presentation === 'column' ? classes.column : classes.outline}
        hidden={presentation === 'rail' && !open}
      >
        {renderNodes(outline.roots)}
        {presentation === 'column' && marker ? (
          <li
            aria-hidden="true"
            className={classes.columnMarker}
            data-placed={markerPlaced.current || undefined}
            style={{ transform: `translateY(${marker.top}px)`, height: marker.height }}
          />
        ) : null}
      </ol>
    </div>
  ) : null;

  const outlined = hasTableOfContents(sourceItems);
  // The outline precedes the document in reading and focus order (as the column is seen beside the
  // document's first lines); the track is out of flow, so the visual layout does not depend on it.
  return (
    <div
      className={classes.layout}
      data-outline={outlined || undefined}
      data-placement={contentPlacement}
      data-outline-presentation={outlinePresentation === 'rail' ? 'rail' : undefined}
    >
      {outlined ? <div className={classes.track}>{navigation}</div> : null}
      {children}
    </div>
  );
}
