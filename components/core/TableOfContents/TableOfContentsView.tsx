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
import { useThrottledCallback, useWindowEvent } from '@mantine/hooks';
import {
  TOC_MAX_VISUAL_DEPTH,
  tocAncestors,
  tocOutline,
  tocNearestMark,
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
  /** The document the outline navigates. Core reserves the rail's space beside it at every width. */
  children: ReactNode;
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

/**
 * Scrolls only the outline so the scrubbed entry sits level with the pointer: the preview stays beside
 * the finger, above the hand, instead of collecting at the list's lower edge. Near the list's edges the
 * entry stays whole inside the list's padding instead of following the pointer out of view.
 */
function alignInList(list: HTMLElement | null, index: number, clientY: number) {
  const link = list?.querySelector<HTMLElement>(`[data-toc-index="${index}"]`);
  if (!list || !link) {
    return;
  }
  const listBox = list.getBoundingClientRect();
  const linkBox = link.getBoundingClientRect();
  // Measured from the list's padding edge, the origin of its scroll position.
  const edge = listBox.top + list.clientTop;
  const linkTop = linkBox.top - edge + list.scrollTop;
  const level = linkTop + linkBox.height / 2 - (clientY - edge);
  const padding = Number.parseFloat(getComputedStyle(list).paddingTop) || 0;
  const whole = Math.min(Math.max(level, linkTop + linkBox.height + padding - list.clientHeight), linkTop - padding);
  list.scrollTop = Math.min(Math.max(0, whole), Math.max(0, list.scrollHeight - list.clientHeight));
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
 * Reserves a quiet rail beside a document at every width. The rail reveals one bounded, nonmodal
 * scrolling outline on hover, focus, press or scrub.
 */
export function TableOfContentsView({ items: sourceItems, title, children }: TableOfContentsViewProps) {
  const listId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLAnchorElement>(null);
  const marksRef = useRef<HTMLSpanElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const targets = useRef<{ element: HTMLElement; index: number }[]>([]);
  const pointerInside = useRef(false);
  const scrub = useRef<ScrubState | null>(null);
  const scrubIndexRef = useRef<number | null>(null);
  const scrubY = useRef(0);
  const suppressClick = useRef(false);
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [scrubIndex, setScrubIndexState] = useState<number | null>(null);
  const open = hovered || keyboardOpen || scrubIndex !== null;

  const setScrubIndex = useCallback((index: number | null) => {
    scrubIndexRef.current = index;
    setScrubIndexState(index);
  }, []);

  // A preview points into the outline it was started on, so it is dropped together with that outline:
  // when the headings change and when the new ones replace them. A later effect would also drop a
  // preview started on the new outline before the effect ran.
  useEffect(() => {
    setHovered(false);
    setKeyboardOpen(false);
    setActiveIndex(0);
    setScrubIndex(null);
    if (!hasTableOfContents(sourceItems)) {
      setItems([]);
      return;
    }
    let timeout: number | undefined;
    const frame = window.requestAnimationFrame(() => {
      timeout = window.setTimeout(
        () =>
          startTransition(() => {
            setScrubIndex(null);
            setItems(sourceItems);
          }),
        0,
      );
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (timeout !== undefined) {
        window.clearTimeout(timeout);
      }
    };
  }, [sourceItems, setScrubIndex]);

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
  // distance: the revealed list fits the screen, with its own scroll, from the start.
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
  }, [hasOutline]);

  // Match the inspected reference: reopening begins at the first title. Only the
  // outline scrolls; current-section updates never override an open list's position.
  useLayoutEffect(() => {
    if (open && list.current && scrubIndexRef.current === null) {
      list.current.scrollTop = 0;
    }
  }, [open]);

  // The outline opens in the same render as the first pointed-at heading, so it is aligned once
  // visible: the previewed row then sits level with the pointer.
  useLayoutEffect(() => {
    if (open && scrubIndex !== null) {
      alignInList(list.current, scrubIndex, scrubY.current);
    }
  }, [open, scrubIndex]);

  const outline = useMemo(() => tocOutline(items.map((item) => item.level)), [items]);
  const ancestors = useMemo(() => new Set(tocAncestors(outline.parents, activeIndex)), [outline, activeIndex]);
  const marks = useMemo(() => tocRailIndices(items.length), [items.length]);
  // The reading position and the pointed-at heading light their own marks, so nothing is overlaid.
  const currentMark = tocNearestMark(marks, activeIndex);
  const previewMark = scrubIndex === null ? -1 : tocNearestMark(marks, scrubIndex);

  function focusFirst() {
    list.current?.querySelector<HTMLAnchorElement>('a')?.focus({ preventScroll: true });
  }

  function closeOutline() {
    setHovered(false);
    setKeyboardOpen(false);
    setScrubIndex(null);
  }

  function cancelScrub() {
    const state = scrub.current;
    if (state && state.pointerType !== 'mouse') {
      suppressClick.current = true;
    }
    if (state) {
      // A canceled drag must not keep steering the rail (or revive as a hover preview).
      try {
        rail.current?.releasePointerCapture?.(state.pointerId);
      } catch {
        // The pointer may already be released.
      }
      if (state.pointerType === 'mouse' && state.active) {
        suppressClick.current = true;
      }
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
    } else if (event.key === 'Tab' || event.key === 'ArrowDown') {
      setKeyboardOpen(true);
    }
  }

  function navigateTo(index: number, close: boolean) {
    const item = items[index];
    if (!item) {
      return;
    }
    const heading = document.getElementById(item.id);
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

  function scrubTo(clientY: number, snapToMark = false) {
    const box = marksRef.current?.getBoundingClientRect();
    if (!box) {
      return;
    }
    // A hovering mouse picks the bar under it, so every bar stands for exactly one heading.
    const index = snapToMark
      ? (marks[tocScrubIndex(clientY, box.top, box.height, marks.length)] ?? 0)
      : tocScrubIndex(clientY, box.top, box.height, items.length);
    scrubY.current = clientY;
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
    if (!state && event.pointerType === 'mouse') {
      // Hovering the rail points at a heading directly; a click then opens it. A held button is a
      // drag that was canceled, not a hover.
      if (event.buttons === 0) {
        scrubTo(event.clientY, true);
      }
      return;
    }
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
    if (!state.active && state.pointerType === 'mouse') {
      // A plain click keeps the hovered heading; the click handler opens it.
      return;
    }
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
      aria-label={title}
      className={classes.wrapper}
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
        // Leaving the outline ends a hover preview even when the rail did not report its own leave.
        if (!scrub.current) {
          setScrubIndex(null);
        }
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
          } else if (scrubIndexRef.current !== null) {
            navigateTo(scrubIndexRef.current, false);
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
        onPointerLeave={(event) => {
          if (!scrub.current && event.pointerType === 'mouse') {
            setScrubIndex(null);
          }
        }}
        onContextMenu={(event) => {
          if (scrub.current) {
            event.preventDefault();
          }
        }}
      >
        <span ref={marksRef} className={classes.marks} aria-hidden="true">
          {marks.map((index, position) => (
            <span
              key={index}
              className={classes.mark}
              data-depth={Math.min(TOC_MAX_VISUAL_DEPTH, outline.depths[index])}
              data-current={position === currentMark || undefined}
              data-preview={position === previewMark || undefined}
            />
          ))}
        </span>
      </a>
      <ol id={listId} ref={list} className={classes.outline} hidden={!open}>
        {renderNodes(outline.roots)}
      </ol>
    </div>
  ) : null;

  const outlined = hasTableOfContents(sourceItems);
  // The outline precedes the document in reading and focus order (the rail sits beside the
  // document's first lines); the track is out of flow, so the visual layout does not depend on it.
  return (
    <div className={classes.layout} data-outline={outlined || undefined}>
      {outlined ? <div className={classes.track}>{navigation}</div> : null}
      {children}
    </div>
  );
}
