// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MAP_CONFIG, type MapConfig } from '@/lib/types/map/model';
import { useMapLevaControls } from './MapLevaControls';

const mocks = vi.hoisted(() => ({
  set: vi.fn(),
  sync: vi.fn(),
}));

vi.mock('leva', () => ({
  button: (callback: () => void) => callback,
  folder: (schema: unknown) => schema,
  useControls: () => [{}, mocks.set],
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/hooks/useLevaSync', () => ({
  useLevaSyncGuard: () => ({
    guardedOnChange: <T,>(callback: (value: T) => void) => callback,
    sync: mocks.sync,
  }),
}));

function Harness({ config }: { config: MapConfig }) {
  useMapLevaControls({ config, onConfigChange: vi.fn() });
  return null;
}

describe('useMapLevaControls interaction synchronization', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
    mocks.set.mockReset();
    mocks.sync.mockReset();
  });

  it('reconciles every durable interaction toggle after a live document update', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root?.render(<Harness config={DEFAULT_MAP_CONFIG} />);
    });

    mocks.sync.mockClear();
    act(() => {
      root?.render(
        <Harness
          config={{
            ...DEFAULT_MAP_CONFIG,
            draggable: false,
            zoomable: false,
            rotatable: true,
            tiltable: true,
            pinClickable: false,
            showDirections: false,
          }}
        />,
      );
    });

    expect(mocks.sync).toHaveBeenCalledWith(mocks.set, {
      draggable: false,
      zoomable: false,
      rotatable: true,
      tiltable: true,
      pinClickable: false,
      showDirections: false,
    });
  });
});
