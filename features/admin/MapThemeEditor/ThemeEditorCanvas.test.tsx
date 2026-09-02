// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ThemeSettings, ThemeVariant } from '@/lib/types/map-theme/model';
import { DEFAULT_THEME_SETTINGS } from '@/lib/types/map-theme/schema';
import { TestProviders } from '@/test/TestProviders';
import { parseColorToRgba, ThemeEditorCanvas } from './ThemeEditorCanvas';

vi.mock('next/dynamic', () => ({
  default: () =>
    function DynamicMapStub({ themeConfig }: { themeConfig: unknown }) {
      return <div data-testid="map-theme-config">{JSON.stringify(themeConfig)}</div>;
    },
}));

vi.mock('leva', async () => {
  const React = await import('react');

  function unwrapControls(config: Record<string, unknown>) {
    const entries: Array<{ value: unknown; onChange?: (value: unknown) => void }> = [];

    for (const entry of Object.values(config)) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      if ('__folder' in entry) {
        const folderEntry = entry as unknown as { controls: Record<string, unknown> };
        entries.push(...unwrapControls(folderEntry.controls));
        continue;
      }

      if ('value' in entry) {
        entries.push(entry as { value: unknown; onChange?: (value: unknown) => void });
      }
    }

    return entries;
  }

  return {
    button: (onClick: () => void) => ({ __button: true, onClick }),
    folder: (controls: Record<string, unknown>) => ({ __folder: true, controls }),
    LevaPanel: () => null,
    useCreateStore: () => React.useRef({}).current,
    useControls: (factory: () => Record<string, unknown>, _options?: unknown, _deps?: unknown) => {
      const previousValuesRef = React.useRef<unknown[] | null>(null);
      const replayedRef = React.useRef(false);
      const config = factory();
      const controls = unwrapControls(config);

      React.useEffect(() => {
        if (!replayedRef.current && previousValuesRef.current) {
          controls.forEach((control, index) => {
            if (typeof control.onChange === 'function') {
              control.onChange(previousValuesRef.current?.[index]);
            }
          });
          replayedRef.current = true;
        }

        previousValuesRef.current = controls.map((control) => control.value);
      });

      const setControls = React.useCallback(() => {}, []);
      return [{}, setControls];
    },
  };
});

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});

Object.defineProperty(window, 'requestAnimationFrame', {
  writable: true,
  value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0),
});

Object.defineProperty(window, 'cancelAnimationFrame', {
  writable: true,
  value: (handle: number) => window.clearTimeout(handle),
});

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

function render(node: React.ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(<TestProviders>{node}</TestProviders>);
  });
}

async function flushUpdates() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function parseThemeConfig(): Record<string, unknown> {
  const content = container?.querySelector('[data-testid="map-theme-config"]')?.textContent;
  expect(content).toBeTruthy();
  return JSON.parse(content as string) as Record<string, unknown>;
}

const LIGHT_VARIANT: Omit<ThemeVariant, 'id'> = {
  scheme: 'light',
  backgroundColor: '#ffffff',
  waterColor: '#8895a5',
  landColor: '#a1a1a1',
  roadColor: 'rgba(0,0,0,0.80)',
  buildingFillColor: 'rgba(221,221,221,0.7)',
  buildingStrokeEnabled: false,
  buildingStrokeColor: 'rgba(204,204,204,0.5)',
  calloutLineColor: 'rgba(176,45,35,0.90)',
  calloutHoverLineColor: '#b02d23',
  calloutTextColor: '#ffffff',
  calloutHoverTextColor: '#ffffff',
  calloutDescriptionColor: '#ffffff',
  calloutHoverDescriptionColor: '#ffffff',
  calloutBackgroundColor: 'rgba(176,45,35,0.90)',
  calloutHoverBackgroundColor: '#b02d23',
  attributionColor: '#ffffff',
  labelTextColor: '#000000',
  clusterColor: 'rgba(217,11,11,0.64)',
  clusterHoverColor: '#d90b0b',
  clusterTextColor: 'rgba(255,255,255,0.90)',
  clusterTextHoverColor: '#ffffff',
};

const DARK_VARIANT: Omit<ThemeVariant, 'id'> = {
  scheme: 'dark',
  backgroundColor: '#0b0b0b',
  waterColor: '#000000',
  landColor: '#252540',
  roadColor: 'rgba(154,151,151,0.80)',
  buildingFillColor: 'rgba(61,61,92,0.7)',
  buildingStrokeEnabled: false,
  buildingStrokeColor: 'rgba(74,74,106,0.5)',
  calloutLineColor: '#b02d23',
  calloutHoverLineColor: '#b02d23',
  calloutTextColor: '#ffffff',
  calloutHoverTextColor: '#ffffff',
  calloutDescriptionColor: 'rgba(255,255,255,0.80)',
  calloutHoverDescriptionColor: '#ffffff',
  calloutBackgroundColor: 'rgba(176,45,35,0.84)',
  calloutHoverBackgroundColor: '#b02d23',
  attributionColor: '#ffffff',
  labelTextColor: '#ffffff',
  clusterColor: 'rgba(176,45,35,0.84)',
  clusterHoverColor: '#b02d23',
  clusterTextColor: '#ffffff',
  clusterTextHoverColor: '#ffffff',
};

function Harness({ settings }: { settings: ThemeSettings }) {
  const [variant, setVariant] = React.useState<Omit<ThemeVariant, 'id'>>(LIGHT_VARIANT);

  return (
    <>
      <button type="button" onClick={() => setVariant(DARK_VARIANT)}>
        Switch To Dark
      </button>
      <ThemeEditorCanvas
        variant={variant}
        settings={settings}
        showControls={false}
        onVariantChange={setVariant}
        onSettingsChange={() => {}}
      />
    </>
  );
}

describe('ThemeEditorCanvas', () => {
  it('parses every color form allowed by the Map Theme contract', () => {
    expect(parseColorToRgba('#123')).toEqual({ r: 17, g: 34, b: 51, a: 1 });
    expect(parseColorToRgba('#1234')).toEqual({ r: 17, g: 34, b: 51, a: 68 / 255 });
    expect(parseColorToRgba('#112233')).toEqual({ r: 17, g: 34, b: 51, a: 1 });
    expect(parseColorToRgba('#11223344')).toEqual({ r: 17, g: 34, b: 51, a: 68 / 255 });
    expect(parseColorToRgba(' rgb( 17 , 34 , 51 ) ')).toEqual({ r: 17, g: 34, b: 51, a: 1 });
    expect(parseColorToRgba('rgba( 17, 34 , 51, 0.5 )')).toEqual({ r: 17, g: 34, b: 51, a: 0.5 });
    expect(parseColorToRgba('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    expect(() => parseColorToRgba('rgb(999, 34, 51)')).toThrow('Unsupported Map Theme color');
  });

  it('keeps dark variant colors when switching schemes', async () => {
    render(<Harness settings={DEFAULT_THEME_SETTINGS} />);

    expect(parseThemeConfig().backgroundColor).toBe(LIGHT_VARIANT.backgroundColor);

    const button = container?.querySelector('button');
    expect(button).not.toBeNull();

    act(() => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    await flushUpdates();

    const themeConfig = parseThemeConfig();
    expect(themeConfig.backgroundColor).toBe(DARK_VARIANT.backgroundColor);
    expect(themeConfig.waterColor).toBe(DARK_VARIANT.waterColor);
    expect(themeConfig.labelTextColor).toBe(DARK_VARIANT.labelTextColor);
  });
});
