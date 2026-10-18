// @vitest-environment jsdom

import { act } from 'react';
import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MAP_CONFIG } from '@/lib/types/map/model';
import { MapLibreMapEditor } from './MapLibreMapEditor';

const mocks = vi.hoisted(() => ({
  locale: 'en',
  mapProps: null as Record<string, unknown> | null,
}));

vi.mock('next/dynamic', () => ({
  default: () => (props: Record<string, unknown>) => {
    mocks.mapProps = props;
    return <div data-testid="map" />;
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: {
      id: 'theme-1',
      scheme: 'light',
      settings: { showAreaLabels: true, showPoiLabels: true },
      variant: {},
    },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    if (key === 'copyValueTitle') {
      return mocks.locale === 'ko' ? `${values?.label} 값 복사` : `Click to copy ${values?.label} value`;
    }

    return key;
  },
}));

vi.mock('@/features/map/MapParameterControls', () => ({
  useMapParameterControls: () => ({ model: { Zoom: { kind: 'number', value: 12 } } }),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  mocks.locale = 'en';
  mocks.mapProps = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
});

describe('MapLibreMapEditor interactions', () => {
  it.each([
    {
      name: 'uses each enabled stored setting when the editor is interactive',
      interactive: true,
      config: {
        draggable: true,
        zoomable: false,
        rotatable: true,
        tiltable: false,
        pinClickable: true,
      },
      expected: {
        draggable: true,
        zoomable: false,
        rotatable: true,
        tiltable: false,
        pinClickable: true,
      },
    },
    {
      name: 'uses each disabled stored setting when the editor is interactive',
      interactive: true,
      config: {
        draggable: false,
        zoomable: true,
        rotatable: false,
        tiltable: true,
        pinClickable: false,
      },
      expected: {
        draggable: false,
        zoomable: true,
        rotatable: false,
        tiltable: true,
        pinClickable: false,
      },
    },
    {
      name: 'disables camera gestures but preserves configured pin clicks when editing is disabled',
      interactive: false,
      config: {
        draggable: true,
        zoomable: true,
        rotatable: true,
        tiltable: true,
        pinClickable: true,
      },
      expected: {
        draggable: false,
        zoomable: false,
        rotatable: false,
        tiltable: false,
        pinClickable: true,
      },
    },
    {
      name: 'preserves disabled pin clicks when editing is disabled',
      interactive: false,
      config: {
        draggable: true,
        zoomable: true,
        rotatable: true,
        tiltable: true,
        pinClickable: false,
      },
      expected: {
        draggable: false,
        zoomable: false,
        rotatable: false,
        tiltable: false,
        pinClickable: false,
      },
    },
  ])('$name', ({ config, expected, interactive }) => {
    act(() => {
      root?.render(
        <DesignSystemProvider>
          <MapLibreMapEditor
            config={{ ...DEFAULT_MAP_CONFIG, ...config }}
            interactive={interactive}
            onConfigChange={vi.fn()}
            places={[]}
          />
        </DesignSystemProvider>,
      );
    });

    expect(mocks.mapProps).toEqual(expect.objectContaining(expected));
  });
});
