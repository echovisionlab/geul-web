// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSeriesOgLifecycle } from './useSeriesOgLifecycle';

const mocks = vi.hoisted(() => ({
  trackGeneration: vi.fn(),
  trackLatest: vi.fn(),
  trackRequestedGeneration: vi.fn(),
  useOgImage: vi.fn(),
}));

let host: HTMLDivElement | null = null;
let root: Root | null = null;
let latest: ReturnType<typeof useSeriesOgLifecycle> | null = null;

vi.mock('@/lib/hooks/useOgImage', () => ({
  useOgImage: (...args: unknown[]) => mocks.useOgImage(...args),
}));

function Probe() {
  latest = useSeriesOgLifecycle({
    seriesId: 'series-1',
    locale: 'ko',
    initialOgImageUrl: 'https://cdn.example.test/series.webp',
  });
  return null;
}

beforeEach(() => {
  mocks.useOgImage.mockReturnValue({
    src: 'https://cdn.example.test/series.webp',
    trackGeneration: mocks.trackGeneration,
    trackLatest: mocks.trackLatest,
    trackRequestedGeneration: mocks.trackRequestedGeneration,
  });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root?.render(<Probe />));
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  host = null;
  root = null;
  latest = null;
  vi.clearAllMocks();
});

describe('useSeriesOgLifecycle', () => {
  it('uses the providerless canonical Series target', () => {
    expect(mocks.useOgImage).toHaveBeenCalledWith({
      entityType: 'series',
      entityId: 'series-1',
      initialOgImageUrl: 'https://cdn.example.test/series.webp',
      locale: 'ko',
      provider: null,
    });
  });

  it('tracks a manual response by its returned generation ID', () => {
    act(() => latest?.trackManualGeneration('generation-1', 'series:ko'));
    expect(mocks.trackRequestedGeneration).toHaveBeenCalledWith('generation-1', 'series:ko');
  });

  it('falls back to the latest target when a manual response has no generation ID', () => {
    act(() => latest?.trackManualGeneration(undefined, 'series:ko'));
    expect(mocks.trackRequestedGeneration).toHaveBeenCalledWith(undefined, 'series:ko');
  });

  it('starts polling for title and featured-image runs but ignores unrelated updates', () => {
    act(() => {
      latest?.trackTitleUpdate({ title: 'Updated title' });
      latest?.trackTitleUpdate({});
      latest?.trackAutomaticGenerationRun('featured-run');
      latest?.trackAutomaticGenerationRun();
    });
    expect(mocks.trackLatest).toHaveBeenCalledTimes(2);
  });
});
