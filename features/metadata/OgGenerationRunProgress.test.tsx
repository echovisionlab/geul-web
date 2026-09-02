// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import type { OgGenerationRunState } from '@/lib/types/og-generation';
import { OgGenerationRunProgress } from './OgGenerationRunProgress';

let host: HTMLDivElement | null = null;
let root: Root | null = null;

function render(run?: OgGenerationRunState | null, error?: string | null) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <TestProviders>
        <OgGenerationRunProgress run={run} error={error} />
      </TestProviders>,
    );
  });
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  host = null;
  root = null;
});

describe('OgGenerationRunProgress', () => {
  it('renders the global ready, failed, processing, queued, and total counts', () => {
    render({
      runId: 'run-1',
      status: 'processing',
      generationCount: 20,
      queuedCount: 4,
      processingCount: 3,
      readyCount: 11,
      failedCount: 2,
      supersededCount: 0,
      cancelledCount: 0,
      failures: [],
    });

    expect(host?.querySelector('[data-testid="og-generation-run-counts"]')?.textContent).toBe(
      'Ready 11 · Failed 2 · Processing 3 · Queued 4 · Total 20',
    );
    expect(host?.querySelector('[role="status"]')?.getAttribute('aria-live')).toBe('polite');
  });

  it('renders bounded failure codes instead of raw provider details and includes a polling error', () => {
    render(
      {
        runId: 'run-1',
        status: 'partially_failed',
        generationCount: 2,
        queuedCount: 0,
        processingCount: 0,
        readyCount: 0,
        failedCount: 2,
        supersededCount: 0,
        cancelledCount: 0,
        failures: [
          {
            generationId: 'generation-1',
            target: { entityType: 'post', entityId: 'post-1', locale: 'ja' },
            errorCode: 'render',
            error: 'Render failed',
          },
          { generationId: 'generation-2', errorCode: 'source', error: 'Source unavailable' },
        ],
      },
      'Last refresh failed',
    );

    expect(host?.textContent).toContain('post:ja · post-1 · OG generation failed (render)');
    expect(host?.textContent).toContain('generation-2 · OG generation failed (source)');
    expect(host?.textContent).not.toContain('Render failed');
    expect(host?.textContent).not.toContain('Source unavailable');
    expect(host?.textContent).toContain('Last refresh failed');
    expect(host?.querySelector('[role="alert"]')?.textContent).toBe('Last refresh failed');
  });
});
