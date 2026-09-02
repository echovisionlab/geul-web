'use client';

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box } from '@mantine/core';
import { useThrottledCallback, useWindowEvent } from '@mantine/hooks';
import classes from './TableOfContents.module.css';

export interface TocItem {
  id: string;
  label: string;
  level: number;
}

interface TocRenderItem extends TocItem {
  originalIndex: number;
}

export interface TableOfContentsViewProps {
  items: TocItem[];
  title: string;
  footerSelector?: string;
}

const MINIMUM_VISIBLE_TOC_ITEMS = 3;

export function TableOfContentsView({ items: sourceItems, title, footerSelector }: TableOfContentsViewProps) {
  const pointerStartRef = useRef<{ index: number | null; x: number; y: number } | null>(null);
  const isScrubbingRef = useRef(false);
  const suppressNextClickRef = useRef(false);
  const headingElementsRef = useRef<HTMLElement[]>([]);
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pointerIndex, setPointerIndex] = useState<number | null>(null);
  const [footerOverlap, setFooterOverlap] = useState(0);
  const [availableHeight, setAvailableHeight] = useState(480);
  const [isScrubbing, setIsScrubbing] = useState(false);

  useEffect(() => {
    setActiveIndex(0);
    setPointerIndex(null);

    if (sourceItems.length <= MINIMUM_VISIBLE_TOC_ITEMS) {
      setItems([]);
      return;
    }

    let timeoutId: number | undefined;
    const animationFrameId = window.requestAnimationFrame(() => {
      timeoutId = window.setTimeout(() => {
        startTransition(() => {
          setItems(sourceItems);
        });
      }, 0);
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [sourceItems]);

  const updateActiveHeading = useCallback(() => {
    const headingElements = headingElementsRef.current;
    if (headingElements.length === 0) {
      return;
    }

    const OFFSET = 100;
    let activeIdx = 0;
    for (let i = 0; i < headingElements.length; i++) {
      if (headingElements[i].getBoundingClientRect().top <= OFFSET) {
        activeIdx = i;
      } else {
        break;
      }
    }
    setActiveIndex(activeIdx);
  }, []);

  const handleHeadingScroll = useThrottledCallback(updateActiveHeading, 100);

  useEffect(() => {
    if (items.length === 0) {
      headingElementsRef.current = [];
      return;
    }

    headingElementsRef.current = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    updateActiveHeading();
  }, [items, updateActiveHeading]);

  useWindowEvent('scroll', handleHeadingScroll, { passive: true });

  const updateFooterOverlap = useCallback(() => {
    const footer = footerSelector ? document.querySelector<HTMLElement>(footerSelector) : null;
    if (!footer) {
      setFooterOverlap(0);
      return;
    }

    const footerTop = footer.getBoundingClientRect().top;
    setFooterOverlap(Math.max(0, window.innerHeight - footerTop));
    setAvailableHeight(Math.max(160, window.innerHeight - 160));
  }, [footerSelector]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }

    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  useEffect(() => {
    updateFooterOverlap();
  }, [updateFooterOverlap]);
  useWindowEvent('scroll', updateFooterOverlap, { passive: true });
  useWindowEvent('resize', updateFooterOverlap);

  const collapsedMaxLevel = useMemo(() => {
    const levels = [...new Set(items.map((item) => item.level))].sort((a, b) => a - b);
    if (levels.length === 0) {
      return 6;
    }

    const minimumLevel = levels[0];
    const targetRows = Math.max(1, Math.floor(availableHeight / 6));
    for (const level of levels) {
      if (items.filter((item) => item.level <= level).length > targetRows) {
        return Math.max(minimumLevel, level - 1);
      }
    }

    return levels[levels.length - 1];
  }, [availableHeight, items]);

  const findClosestTocIndex = useCallback((container: HTMLDivElement, clientY: number) => {
    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('[data-toc-index]'));
    if (links.length === 0) {
      return null;
    }

    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    links.forEach((link, index) => {
      const rect = link.getBoundingClientRect();
      const distance = Math.abs(clientY - (rect.top + rect.height / 2));
      if (distance < closestDistance) {
        closestIndex = Number(link.dataset.tocIndex ?? index);
        closestDistance = distance;
      }
    });

    return closestIndex;
  }, []);

  const scrubToIndex = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item) {
        return;
      }

      document.getElementById(item.id)?.scrollIntoView({ behavior: 'auto', block: 'start' });
    },
    [items],
  );

  const smoothScrollToIndex = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item) {
        return;
      }

      document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [items],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const closestIndex = findClosestTocIndex(e.currentTarget, e.clientY);
      setPointerIndex(closestIndex);

      const start = pointerStartRef.current;
      if (start) {
        const dragDistance = Math.hypot(e.clientX - start.x, e.clientY - start.y);
        if (dragDistance > 4) {
          suppressNextClickRef.current = true;
          isScrubbingRef.current = true;
          setIsScrubbing(true);
        }
      }

      if (closestIndex !== null && isScrubbingRef.current) {
        e.preventDefault();
        scrubToIndex(closestIndex);
      }
    },
    [findClosestTocIndex, scrubToIndex],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) {
        return;
      }

      e.currentTarget.setPointerCapture(e.pointerId);
      const closestIndex = findClosestTocIndex(e.currentTarget, e.clientY);
      setPointerIndex(closestIndex);
      pointerStartRef.current = {
        index: closestIndex,
        x: e.clientX,
        y: e.clientY,
      };
    },
    [findClosestTocIndex],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.releasePointerCapture(e.pointerId);
      const start = pointerStartRef.current;
      const didScrub = isScrubbingRef.current;
      pointerStartRef.current = null;
      isScrubbingRef.current = false;
      setIsScrubbing(false);
      if (!didScrub && start?.index != null) {
        smoothScrollToIndex(start.index);
        suppressNextClickRef.current = true;
        window.setTimeout(() => {
          suppressNextClickRef.current = false;
        }, 250);
        return;
      }

      if (didScrub) {
        suppressNextClickRef.current = true;
        window.setTimeout(() => {
          suppressNextClickRef.current = false;
        }, 250);
      }
    },
    [smoothScrollToIndex],
  );

  const handlePointerLeave = useCallback(() => {
    if (isScrubbing) {
      return;
    }
    setPointerIndex(null);
  }, [isScrubbing]);

  const getPointerProximity = useCallback(
    (index: number) => {
      if (pointerIndex === null) {
        return 0;
      }

      const distance = Math.abs(index - pointerIndex);
      if (distance === 0) {
        return 1;
      }
      if (distance === 1) {
        return 0.65;
      }
      if (distance === 2) {
        return 0.35;
      }
      if (distance === 3) {
        return 0.15;
      }

      return 0;
    },
    [pointerIndex],
  );

  const renderItems = useMemo<TocRenderItem[]>(() => {
    return items
      .map((item, originalIndex) => ({ ...item, originalIndex }))
      .filter((item) => {
        if (item.level <= collapsedMaxLevel) {
          return true;
        }

        const focusIndex = pointerIndex ?? activeIndex;
        return Math.abs(item.originalIndex - focusIndex) <= 4;
      });
  }, [activeIndex, collapsedMaxLevel, items, pointerIndex]);

  const links = useMemo(
    () =>
      renderItems.map((item) => {
        const isActive = activeIndex === item.originalIndex;
        const isPointed = pointerIndex === item.originalIndex;
        const proximity = getPointerProximity(item.originalIndex);
        const isCollapsedChild = item.level > collapsedMaxLevel;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            onClick={(e) => handleClick(e, item.id)}
            onDragStart={(e) => e.preventDefault()}
            className={`${classes.link} ${classes[`level${item.level}`]} ${
              isActive ? classes.linkActive : ''
            } ${isPointed ? classes.linkPointed : ''} ${isCollapsedChild ? classes.linkRevealedChild : ''}`}
            data-toc-index={item.originalIndex}
            draggable={false}
            style={
              {
                '--toc-row-extra': `${proximity * 12}px`,
                '--toc-bar-extra': `${proximity * 12}px`,
                '--toc-bar-scale': 1 + proximity * 1.2,
              } as React.CSSProperties
            }
          >
            <span className={classes.linkText}>{item.label}</span>
          </a>
        );
      }),
    [activeIndex, collapsedMaxLevel, getPointerProximity, handleClick, pointerIndex, renderItems],
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <Box className={classes.wrapper} style={{ '--toc-footer-overlap': `${footerOverlap}px` } as React.CSSProperties}>
      <div
        className={classes.root}
        data-scrubbing={isScrubbing ? 'true' : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        style={
          {
            '--active-index': activeIndex,
            '--toc-count': Math.max(1, renderItems.length),
          } as React.CSSProperties
        }
      >
        <div className={classes.title}>{title}</div>
        <div className={classes.indicator} />
        {links}
      </div>
    </Box>
  );
}
