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

  it('edits actual Core controls and cannot remove the last callout field', async () => {
    const onVariantChange = vi.fn();
    const onSettingsChange = vi.fn();
    render(
      <ThemeEditorCanvas
        variant={LIGHT_VARIANT}
        settings={{ ...DEFAULT_THEME_SETTINGS, calloutFields: ['name'] }}
        onVariantChange={onVariantChange}
        onSettingsChange={onSettingsChange}
      />,
    );
    const triggers = Array.from(
      container!.querySelectorAll<HTMLButtonElement>('button[data-accordion-control][aria-expanded]'),
    );
    act(() => {
      triggers.forEach((button) => {
        if (button.getAttribute('aria-expanded') === 'false') {
          button.click();
        }
      });
    });
    await flushUpdates();
    const stroke = Array.from(container!.querySelectorAll<HTMLInputElement>('input[type=checkbox]')).find((input) =>
      input.closest('label')?.textContent?.includes('Stroke'),
    );
    expect(stroke).toBeTruthy();
    act(() => stroke!.click());
    expect(onVariantChange).toHaveBeenCalledWith(
      expect.objectContaining({ buildingStrokeEnabled: true, backgroundColor: LIGHT_VARIANT.backgroundColor }),
    );
    const name = Array.from(container!.querySelectorAll<HTMLInputElement>('input[type=checkbox]')).find(
      (input) => input.closest('label')?.textContent?.replace('✓', '').trim() === 'Name',
    );
    expect(name).toBeTruthy();
    act(() => name!.click());
    expect(onSettingsChange).not.toHaveBeenCalled();
  });

  it('exposes separate view, sample count and rotation names without changing visible labels', async () => {
    render(
      <ThemeEditorCanvas
        variant={LIGHT_VARIANT}
        settings={DEFAULT_THEME_SETTINGS}
        onVariantChange={() => {}}
        onSettingsChange={() => {}}
      />,
    );
    const mode = container!.querySelector<HTMLElement>('[role="radiogroup"][aria-label="View Mode"]')!;
    expect(mode).not.toBeNull();
    const places = container!.querySelector<HTMLElement>('[role="radiogroup"][aria-label="Mock Places"]')!;
    expect(places).not.toBeNull();
    expect(mode.querySelector<HTMLInputElement>('input[value="2d"]')?.checked).toBe(true);
    expect(places.querySelector<HTMLInputElement>('input[value="1"]')?.checked).toBe(true);
    act(() => mode.querySelector<HTMLInputElement>('input[value="3d"]')!.click());
    await flushUpdates();
    const rotate = container!.querySelector<HTMLInputElement>('input[role="switch"][aria-label="Auto Rotate"]')!;
    expect(rotate).not.toBeNull();
    expect((rotate as HTMLInputElement).checked).toBe(false);
    act(() => rotate.click());
    await flushUpdates();
    expect(rotate.checked).toBe(true);
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
