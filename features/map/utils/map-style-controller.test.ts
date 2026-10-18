import { describe, expect, it, vi } from 'vitest';
import { createMapStyleController, type MapLibreStyle } from './map-style-controller';

function createMapStyleHarness(initiallyLoaded = false) {
  let loaded = initiallyLoaded;
  let activeStyle: MapLibreStyle | undefined;
  let diffFailures = 0;
  let rebuilds = 0;
  let consoleWarnings = 0;
  const listeners = new Set<() => void>();
  const setStyle = vi.fn((style: MapLibreStyle) => {
    if (!loaded) {
      diffFailures += 1;
      rebuilds += 1;
      consoleWarnings = 1;
    }
    activeStyle = style;
    loaded = false;
  });
  const map = {
    isStyleLoaded: vi.fn(() => loaded),
    subscribeStyleReady: vi.fn((listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    setStyle,
  };

  return {
    map,
    setStyle,
    listeners,
    get activeStyle() {
      return activeStyle;
    },
    get loaded() {
      return loaded;
    },
    get diffFailures() {
      return diffFailures;
    },
    get rebuilds() {
      return rebuilds;
    },
    get consoleWarnings() {
      return consoleWarnings;
    },
    finishStyleLoad() {
      loaded = true;
      emitReadinessSignal();
    },
    emitPrematureStyleLoad() {
      emitReadinessSignal();
    },
    finishIdle() {
      loaded = true;
      emitReadinessSignal();
    },
  };

  function emitReadinessSignal() {
    for (const listener of [...listeners]) {
      listener();
    }
  }
}

function createStyle(name: string): MapLibreStyle {
  return { version: 8, name, sources: {}, layers: [] };
}

describe('map style controller', () => {
  it('holds initial replacements and applies only the latest style when the initial style loads', () => {
    const initialStyle = createStyle('initial');
    const firstStyle = createStyle('first');
    const latestStyle = createStyle('latest');
    const harness = createMapStyleHarness();
    const controller = createMapStyleController(harness.map, initialStyle);

    controller.setStyle(firstStyle);
    controller.setStyle(latestStyle);

    expect(harness.setStyle).not.toHaveBeenCalled();

    harness.emitPrematureStyleLoad();

    expect(harness.setStyle).not.toHaveBeenCalled();

    harness.finishIdle();

    expect(harness.setStyle).toHaveBeenCalledOnce();
    expect(harness.setStyle).toHaveBeenCalledWith(latestStyle);
    expect(harness.activeStyle).toBe(latestStyle);

    controller.destroy();
  });

  it('coalesces changes during a replacement, updates immediately when ready, and avoids a duplicate on load', () => {
    const initialStyle = createStyle('initial');
    const firstStyle = createStyle('first');
    const middleStyle = createStyle('middle');
    const latestDuringLoad = createStyle('latest-during-load');
    const readyStyle = createStyle('ready');
    const harness = createMapStyleHarness();
    const controller = createMapStyleController(harness.map, initialStyle);

    controller.setStyle(firstStyle);
    controller.setStyle(middleStyle);
    harness.finishStyleLoad();

    expect(harness.setStyle.mock.calls.map(([style]) => style)).toEqual([middleStyle]);

    controller.setStyle(latestDuringLoad);
    controller.setStyle(readyStyle);
    expect(harness.setStyle.mock.calls.map(([style]) => style)).toEqual([middleStyle]);

    harness.finishStyleLoad();
    expect(harness.setStyle.mock.calls.map(([style]) => style)).toEqual([middleStyle, readyStyle]);

    harness.finishStyleLoad();
    controller.setStyle(readyStyle);
    expect(harness.setStyle).toHaveBeenCalledTimes(2);

    controller.destroy();
  });

  it('removes its style listener and ignores updates after destruction', () => {
    const initialStyle = createStyle('initial');
    const nextStyle = createStyle('next');
    const harness = createMapStyleHarness();
    const controller = createMapStyleController(harness.map, initialStyle);

    expect(harness.listeners.size).toBe(1);
    controller.destroy();
    controller.setStyle(nextStyle);
    harness.finishStyleLoad();

    expect(harness.listeners.size).toBe(0);
    expect(harness.map.subscribeStyleReady).toHaveBeenCalledOnce();
    expect(harness.setStyle).not.toHaveBeenCalled();
  });
});
