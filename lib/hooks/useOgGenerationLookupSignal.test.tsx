// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OgGenerationRunSignal } from '@/lib/types/og-generation';
import { useOgGenerationLookupSignal } from './useOgGenerationLookupSignal';

const trackLatest = vi.fn(async () => true);
let host: HTMLDivElement | null = null;
let root: Root | null = null;

function Probe({ request, locale }: { request: OgGenerationRunSignal | null; locale: string | null }) {
  useOgGenerationLookupSignal(request, locale, trackLatest);
  return null;
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  host = null;
  root = null;
  trackLatest.mockClear();
});

describe('useOgGenerationLookupSignal', () => {
  it('refreshes the latest state only for the locale that produced the signal', () => {
    const request = { runId: 'run-ko', locale: 'ko', sequence: 1 };
    act(() => root?.render(<Probe request={request} locale="ja" />));
    expect(trackLatest).not.toHaveBeenCalled();

    act(() => root?.render(<Probe request={request} locale="ko" />));
    expect(trackLatest).toHaveBeenCalledTimes(1);
  });

  it('refreshes a later run for the same locale by sequence', () => {
    act(() => root?.render(<Probe request={{ runId: 'run-1', locale: 'ko', sequence: 1 }} locale="ko" />));
    act(() => root?.render(<Probe request={{ runId: 'run-2', locale: 'ko', sequence: 2 }} locale="ko" />));
    expect(trackLatest).toHaveBeenCalledTimes(2);
  });
});
