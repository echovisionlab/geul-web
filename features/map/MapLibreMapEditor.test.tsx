// @vitest-environment jsdom

import { act } from 'react';
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

vi.mock('leva', () => ({
  Leva: () => <button data-testid="copy-value" title="Idle" type="button" />,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    if (key === 'copyValueTitle') {
      return mocks.locale === 'ko' ? `${values?.label} 값 복사` : `Click to copy ${values?.label} value`;
    }

    return key;
  },
}));

vi.mock('@mantine/core', () => ({
  Box: ({ children, h: _height, pos: _position, ...props }: any) => <div {...props}>{children}</div>,
  Alert: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  useComputedColorScheme: () => 'light',
}));

vi.mock('@/features/map/MapLevaControls', () => ({
  useMapLevaControls: () => undefined,
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

function renderEditor() {
  act(() => {
    root?.render(<MapLibreMapEditor config={DEFAULT_MAP_CONFIG} onConfigChange={vi.fn()} places={[]} />);
  });

  const target = container?.querySelector<HTMLElement>('[data-testid="copy-value"]');
  expect(target).toBeTruthy();
  return target as HTMLElement;
}

async function changeTitleAndCollectMutations(target: HTMLElement) {
  const mutations: MutationRecord[] = [];
  let sentinelApplied = false;
  const observer = new MutationObserver((records) => {
    mutations.push(...records);

    if (!sentinelApplied && mutations.length >= 4) {
      sentinelApplied = true;
      target.setAttribute('title', 'Mutation loop stopped');
    }
  });
  observer.observe(target, {
    attributes: true,
    attributeFilter: ['title'],
  });

  target.setAttribute('title', 'Click to copy Zoom value');

  await act(async () => {
    for (let index = 0; index < 8; index += 1) {
      await Promise.resolve();
    }
  });

  observer.disconnect();
  return mutations;
}

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
        <MapLibreMapEditor
          config={{ ...DEFAULT_MAP_CONFIG, ...config }}
          interactive={interactive}
          onConfigChange={vi.fn()}
          places={[]}
        />,
      );
    });

    expect(mocks.mapProps).toEqual(expect.objectContaining(expected));
  });
});

describe('MapLibreMapEditor Leva title localization', () => {
  it('does not rewrite an English title when its translation is identical', async () => {
    const target = renderEditor();

    const mutations = await changeTitleAndCollectMutations(target);

    expect(target.title).toBe('Click to copy Zoom value');
    expect(mutations).toHaveLength(1);
  });

  it('localizes a newly added English title exactly once in Korean', async () => {
    mocks.locale = 'ko';
    const target = renderEditor();

    const mutations = await changeTitleAndCollectMutations(target);

    expect(target.title).toBe('Zoom 값 복사');
    expect(mutations).toHaveLength(2);
  });
});
