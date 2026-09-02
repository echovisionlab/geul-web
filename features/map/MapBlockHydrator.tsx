'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MapViewConfig } from '@/lib/types/map/model';
import { MapViewEmbedded } from './MapViewEmbedded';

interface MapBlockData {
  element: Element;
  config: MapViewConfig;
  applyPreviewWidth: boolean;
  blockAlignment?: string | null;
  signature: string;
}

interface MapBlockHydratorProps {
  /** Container ref where HTML content is rendered */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Optional key to force a rescan when the backing HTML changes */
  contentKey?: string | null;
  /** Optional locale override for base map labels inside hydrated map blocks. */
  labelLocale?: string | null;
}

function hasInlineWidthStyle(element: Element | null): boolean {
  if (!element) {
    return false;
  }
  const style = element.getAttribute('style') || '';
  return /\b(?:width|max-width)\s*:/.test(style);
}

/**
 * Parse embedded config from a map-block element
 */
function parseMapBlockElement(element: Element): MapViewConfig | null {
  const configJson = element.getAttribute('data-map-view-config');
  if (!configJson) {
    return null;
  }

  try {
    return JSON.parse(configJson) as MapViewConfig;
  } catch {
    return null;
  }
}

function collectMapBlocks(container: HTMLElement): MapBlockData[] {
  const blocks: MapBlockData[] = [];
  const elements = container.querySelectorAll('.map-block[data-map-view-config]');

  elements.forEach((element) => {
    const configJson = element.getAttribute('data-map-view-config');
    const config = parseMapBlockElement(element);
    if (!config || config.places.length === 0 || !configJson) {
      return;
    }

    const figure = element.closest('figure.map-block-figure');
    const applyPreviewWidth = !hasInlineWidthStyle(element) && !hasInlineWidthStyle(figure as Element | null);
    const blockAlignment = element.getAttribute('data-block-alignment');
    const signature = `${configJson}:${applyPreviewWidth ? '1' : '0'}:${blockAlignment || ''}`;

    if (element.getAttribute('data-map-hydrated-signature') !== signature) {
      element.innerHTML = '';
      element.setAttribute('data-map-hydrated-signature', signature);
    }

    blocks.push({ element, config, applyPreviewWidth, blockAlignment, signature });
  });

  return blocks;
}

function areSameBlocks(current: MapBlockData[], next: MapBlockData[]): boolean {
  if (current.length !== next.length) {
    return false;
  }

  return current.every(
    (block, index) => block.element === next[index]?.element && block.signature === next[index]?.signature,
  );
}

/**
 * Hydrates map-block placeholders in HTML content with interactive MapViewEmbedded components.
 *
 * Reads data-map-view-config JSON attribute containing all embedded place and theme data.
 *
 * Usage:
 * ```tsx
 * const containerRef = useRef<HTMLDivElement>(null);
 * return (
 *   <>
 *     <div ref={containerRef} dangerouslySetInnerHTML={{ __html: html }} />
 *     <MapBlockHydrator containerRef={containerRef} />
 *   </>
 * );
 * ```
 */
export function MapBlockHydrator({ containerRef, contentKey, labelLocale }: MapBlockHydratorProps) {
  const [mapBlocks, setMapBlocks] = useState<MapBlockData[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let frameId: number | null = null;

    const syncBlocks = () => {
      const nextBlocks = collectMapBlocks(container);
      setMapBlocks((current) => (areSameBlocks(current, nextBlocks) ? current : nextBlocks));
    };

    const scheduleSync = () => {
      if (frameId !== null) {
        return;
      }
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        syncBlocks();
      });
    };

    syncBlocks();

    const observer = new MutationObserver(() => {
      scheduleSync();
    });
    observer.observe(container, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [containerRef, contentKey]);

  return (
    <>
      {mapBlocks.map((block, index) => (
        <MapBlockPortal
          key={`${block.signature}:${index}`}
          element={block.element}
          config={block.config}
          applyPreviewWidth={block.applyPreviewWidth}
          blockAlignment={block.blockAlignment ?? undefined}
          labelLocale={labelLocale}
        />
      ))}
    </>
  );
}

interface MapBlockPortalProps {
  element: Element;
  config: MapViewConfig;
  applyPreviewWidth: boolean;
  blockAlignment?: string;
  labelLocale?: string | null;
}

function MapBlockPortal({ element, config, applyPreviewWidth, blockAlignment, labelLocale }: MapBlockPortalProps) {
  const isMobileViewport =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 768px)').matches;

  return createPortal(
    <MapViewEmbedded
      config={config}
      applyPreviewWidth={isMobileViewport ? false : applyPreviewWidth}
      blockAlignment={blockAlignment}
      labelLocale={labelLocale}
    />,
    element,
  );
}
