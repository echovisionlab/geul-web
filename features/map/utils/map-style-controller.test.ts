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

  it('reduces style updates and loading-time rebuilds for the same rapid-change sequence', () => {
    const initialStyle = createStyle('initial');
    const requestedStyles = ['one', 'two', 'three', 'four', 'five'].map(createStyle);
    let baselineLoaded = false;
    let baselineDiffFailures = 0;
    let baselineConsoleWarnings = 0;
    let baselineWarningAlreadyLogged = false;
    let baselineRebuilds = 0;
    // The previous prop path called setStyle for every identity change; MapLibre 6.4 falls back when its style is loading.
    const baselineSetStyle = vi.fn((_style: MapLibreStyle) => {
      if (!baselineLoaded) {
        baselineDiffFailures += 1;
        baselineRebuilds += 1;
        if (!baselineWarningAlreadyLogged) {
          baselineConsoleWarnings += 1;
          baselineWarningAlreadyLogged = true;
        }
      }
      baselineLoaded = false;
    });

    baselineSetStyle(requestedStyles[0]);
    baselineSetStyle(requestedStyles[1]);
    baselineLoaded = true;
    baselineSetStyle(requestedStyles[2]);
    baselineSetStyle(requestedStyles[3]);
    baselineLoaded = true;
    baselineSetStyle(requestedStyles[4]);

    const harness = createMapStyleHarness();
    const controller = createMapStyleController(harness.map, initialStyle);
    controller.setStyle(requestedStyles[0]);
    controller.setStyle(requestedStyles[1]);
    harness.finishStyleLoad();
    controller.setStyle(requestedStyles[2]);
    controller.setStyle(requestedStyles[3]);
    harness.finishStyleLoad();
    harness.finishStyleLoad();
    controller.setStyle(requestedStyles[4]);

    expect({
      directStyleUpdates: baselineSetStyle.mock.calls.length,
      directDiffFailures: baselineDiffFailures,
      directConsoleWarnings: baselineConsoleWarnings,
      directRebuilds: baselineRebuilds,
      controlledStyleUpdates: harness.setStyle.mock.calls.length,
      controlledDiffFailures: harness.diffFailures,
      controlledConsoleWarnings: harness.consoleWarnings,
      controlledRebuilds: harness.rebuilds,
      appliedStyleNames: harness.setStyle.mock.calls.map(([style]) => (style as { name: string }).name),
    }).toEqual({
      directStyleUpdates: 5,
      directDiffFailures: 3,
      directConsoleWarnings: 1,
      directRebuilds: 3,
      controlledStyleUpdates: 3,
      controlledDiffFailures: 0,
      controlledConsoleWarnings: 0,
      controlledRebuilds: 0,
      appliedStyleNames: ['two', 'four', 'five'],
    });

    controller.destroy();
  });
});
