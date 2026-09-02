'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import domtoimage from 'dom-to-image-more';
import type * as maplibregl from 'maplibre-gl';
import { useWindowEvent } from '@mantine/hooks';

interface Options {
  mapRef: RefObject<maplibregl.Map | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  isReady: boolean;
}

export function useMapPrintCapture({ mapRef, containerRef, isReady }: Options) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const capturedRef = useRef(false);
  const captureInProgressRef = useRef(false);
  const captureMethodRef = useRef<'none' | 'canvas' | 'dom'>('none');

  const capture = useCallback(
    async (mode: 'background' | 'beforeprint') => {
      if (
        captureInProgressRef.current ||
        (mode === 'background' && capturedRef.current) ||
        (mode === 'beforeprint' && captureMethodRef.current === 'dom')
      ) {
        return;
      }
      const map = mapRef.current;
      const container = containerRef.current;
      if (!map || !container) {
        return;
      }

      captureInProgressRef.current = true;
      try {
        if (mode === 'beforeprint') {
          try {
            const domCapture = await domtoimage.toJpeg(container, { quality: 1 });
            if (domCapture) {
              setImageUrl(domCapture);
              capturedRef.current = true;
              captureMethodRef.current = 'dom';
              return;
            }
          } catch {
            // WebGL canvas is the fallback when DOM capture is unavailable.
          }
        }

        try {
          const canvasCapture = map.getCanvas().toDataURL('image/jpeg', 0.95);
          if (canvasCapture && canvasCapture !== 'data:,') {
            setImageUrl(canvasCapture);
            capturedRef.current = true;
            if (captureMethodRef.current === 'none') {
              captureMethodRef.current = 'canvas';
            }
          }
        } catch {
          // The interactive map remains the print fallback when snapshot generation fails.
        }
      } finally {
        captureInProgressRef.current = false;
      }
    },
    [containerRef, mapRef],
  );

  useEffect(() => {
    if (!isReady || capturedRef.current || !mapRef.current) {
      return;
    }
    const map = mapRef.current;
    let cancelled = false;
    const captureWhenSettled = () => {
      if (cancelled || capturedRef.current) {
        return;
      }
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (!cancelled) {
            void capture('background');
          }
        });
      });
    };
    if (map.loaded() && map.areTilesLoaded()) {
      captureWhenSettled();
    } else {
      map.once('idle', captureWhenSettled);
    }
    return () => {
      cancelled = true;
      map.off('idle', captureWhenSettled);
    };
  }, [capture, isReady, mapRef]);

  useWindowEvent('beforeprint', () => {
    if (isReady) {
      void capture('beforeprint');
    }
  });

  return imageUrl;
}
