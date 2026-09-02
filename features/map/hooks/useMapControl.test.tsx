// @vitest-environment jsdom

import { act, useEffect, type RefObject } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMapControl, type UseMapControlOptions } from './useMapControl';

type HookResult = ReturnType<typeof useMapControl>;

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface MockMap {
  getCenter: () => { lat: number; lng: number };
  getZoom: () => number;
  getPitch: () => number;
  getBearing: () => number;
  easeTo: () => void;
  jumpTo: () => void;
}

function Harness({ options, onReady }: { options: UseMapControlOptions; onReady: (handlers: HookResult) => void }) {
  const handlers = useMapControl(options);

  useEffect(() => {
    onReady(handlers);
  }, [handlers, onReady]);

  return null;
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function renderHarness(options: UseMapControlOptions, onReady: (handlers: HookResult) => void): void {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(<Harness options={options} onReady={onReady} />);
  });
}

function rerenderHarness(options: UseMapControlOptions, onReady: (handlers: HookResult) => void): void {
  act(() => {
    root?.render(<Harness options={options} onReady={onReady} />);
  });
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
});

describe('useMapControl', () => {
  it('persists zoom changes when zoom end is marked as a user interaction', () => {
    let currentZoom = 12;
    let handlers: HookResult | null = null;
    const onZoomChange = vi.fn();
    const mapRef = {
      current: {
        getCenter: () => ({ lat: 37.5665, lng: 126.978 }),
        getZoom: () => currentZoom,
        getPitch: () => 0,
        getBearing: () => 0,
        easeTo: () => {},
        jumpTo: () => {},
      } satisfies MockMap,
    };

    renderHarness(
      {
        mapRef: mapRef as RefObject<any>,
        isReady: true,
        center: { lat: 37.5665, lng: 126.978 },
        zoom: 12,
        pitch: 0,
        bearing: 0,
        onZoomChange,
      },
      (nextHandlers) => {
        handlers = nextHandlers;
      },
    );

    currentZoom = 14.25;

    act(() => {
      handlers?.handleZoomEnd(true);
    });

    expect(onZoomChange).toHaveBeenCalledWith(14.25);
  });

  it('ignores zoom end events that were not caused by a user interaction', () => {
    let handlers: HookResult | null = null;
    const onZoomChange = vi.fn();
    const mapRef = {
      current: {
        getCenter: () => ({ lat: 37.5665, lng: 126.978 }),
        getZoom: () => 12,
        getPitch: () => 0,
        getBearing: () => 0,
        easeTo: () => {},
        jumpTo: () => {},
      } satisfies MockMap,
    };

    renderHarness(
      {
        mapRef: mapRef as RefObject<any>,
        isReady: true,
        center: { lat: 37.5665, lng: 126.978 },
        zoom: 12,
        pitch: 0,
        bearing: 0,
        onZoomChange,
      },
      (nextHandlers) => {
        handlers = nextHandlers;
      },
    );

    act(() => {
      handlers?.handleZoomEnd(false);
    });

    expect(onZoomChange).not.toHaveBeenCalled();
  });

  it('restores the logical center after a centered zoom drifts it away', () => {
    let handlers: HookResult | null = null;
    const easeTo = vi.fn();
    const mapRef = {
      current: {
        getCenter: () => ({ lat: 0, lng: 0 }),
        getZoom: () => 5.5,
        getPitch: () => 42,
        getBearing: () => -18,
        easeTo,
        jumpTo: () => {},
      } satisfies MockMap,
    };

    renderHarness(
      {
        mapRef: mapRef as RefObject<any>,
        isReady: true,
        center: { lat: 37.5665, lng: 126.978 },
        zoom: 5,
        pitch: 0,
        bearing: 0,
      },
      (nextHandlers) => {
        handlers = nextHandlers;
      },
    );

    act(() => {
      handlers?.handleZoomEnd(true, true);
    });

    expect(easeTo).toHaveBeenCalledWith({
      center: [126.978, 37.5665],
      zoom: 5.5,
      pitch: 42,
      bearing: -18,
      duration: 300,
    });
  });

  it('does not overwrite the logical center when centered zoom moveend reports drift', () => {
    let handlers: HookResult | null = null;
    const easeTo = vi.fn();
    const onCenterChange = vi.fn();
    const mapRef = {
      current: {
        getCenter: () => ({ lat: 0, lng: 0 }),
        getZoom: () => 5.5,
        getPitch: () => 42,
        getBearing: () => -18,
        easeTo,
        jumpTo: () => {},
      } satisfies MockMap,
    };

    renderHarness(
      {
        mapRef: mapRef as RefObject<any>,
        isReady: true,
        center: { lat: 37.5665, lng: 126.978 },
        zoom: 5,
        pitch: 0,
        bearing: 0,
        onCenterChange,
      },
      (nextHandlers) => {
        handlers = nextHandlers;
      },
    );

    act(() => {
      handlers?.handleMoveEnd(true, false);
      handlers?.handleZoomEnd(true, true);
    });

    expect(onCenterChange).not.toHaveBeenCalled();
    expect(easeTo).toHaveBeenCalledWith({
      center: [126.978, 37.5665],
      zoom: 5.5,
      pitch: 42,
      bearing: -18,
      duration: 300,
    });
  });

  it('applies small remote zoom deltas instead of treating them as already synced', () => {
    let handlers: HookResult | null = null;
    const easeTo = vi.fn();
    const mapRef = {
      current: {
        getCenter: () => ({ lat: 37.5665, lng: 126.978 }),
        getZoom: () => 12,
        getPitch: () => 0,
        getBearing: () => 0,
        easeTo,
        jumpTo: () => {},
      } satisfies MockMap,
    };

    const onReady = (nextHandlers: HookResult) => {
      handlers = nextHandlers;
    };

    renderHarness(
      {
        mapRef: mapRef as RefObject<any>,
        isReady: true,
        center: { lat: 37.5665, lng: 126.978 },
        zoom: 12,
        pitch: 0,
        bearing: 0,
      },
      onReady,
    );

    rerenderHarness(
      {
        mapRef: mapRef as RefObject<any>,
        isReady: true,
        center: { lat: 37.5665, lng: 126.978 },
        zoom: 11.95,
        pitch: 0,
        bearing: 0,
      },
      onReady,
    );

    expect(handlers).not.toBeNull();
    expect(easeTo).toHaveBeenCalledWith({
      center: [126.978, 37.5665],
      zoom: 11.95,
      pitch: 0,
      bearing: 0,
      duration: 300,
    });
  });
});
