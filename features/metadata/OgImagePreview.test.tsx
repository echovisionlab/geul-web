// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { OgImagePreview } from './OgImagePreview';

let host: HTMLDivElement | null = null;
let root: Root | null = null;

function renderPreview(props: React.ComponentProps<typeof OgImagePreview>) {
  if (!host) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  }
  act(() => {
    root?.render(
      <TestProviders>
        <OgImagePreview {...props} />
      </TestProviders>,
    );
  });
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.clearAllMocks();
});

describe('OgImagePreview lifecycle presentation', () => {
  it.each([
    ['queued', 'Queued'],
    ['processing', 'Processing'],
    ['ready', 'Ready'],
    ['failed', 'Failed'],
    ['superseded', 'Replaced by a newer request'],
    ['cancelled', 'Cancelled'],
  ] as const)('renders %s as a distinct header icon with an accessible live status', (status, label) => {
    renderPreview({ generationStatus: status });

    const header = host?.querySelector('[data-testid="og-image-header"]');
    const statusIcon = header?.querySelector('[data-testid="og-generation-status-icon"]');
    const liveStatus = host?.querySelector('[data-testid="og-generation-live-status"]');

    expect(statusIcon?.getAttribute('data-status')).toBe(status);
    expect(statusIcon?.getAttribute('aria-label')).toBe(label);
    expect(statusIcon?.querySelector(`[data-testid="og-generation-icon-${status}"]`)).not.toBeNull();
    expect(liveStatus?.textContent).toBe(label);
    expect(liveStatus?.getAttribute('aria-live')).toBe(
      status === 'failed' || status === 'cancelled' ? 'assertive' : 'polite',
    );
    expect(host?.querySelector('[data-testid="og-generation-status"]')).toBeNull();
    expect(host?.querySelector('[data-testid="og-generation-error"]')).toBeNull();
  });

  it('keeps the regenerate action before the status icon at the far right of the header', () => {
    const onRegenerate = vi.fn();
    renderPreview({
      canRegenerate: true,
      generationStatus: 'ready',
      onRegenerate,
    });

    const actions = host?.querySelector('[data-testid="og-image-header-actions"]');
    const regenerate = actions?.querySelector<HTMLButtonElement>('[aria-label="Regenerate OG Image"]');
    const statusIcon = actions?.querySelector('[data-testid="og-generation-status-icon"]');

    expect(regenerate).not.toBeNull();
    expect(statusIcon).not.toBeNull();
    if (!(actions && regenerate && statusIcon)) {
      throw new Error('Expected regenerate and status actions in the OG image header');
    }
    expect(regenerate.compareDocumentPosition(statusIcon) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(statusIcon).toBe(actions.lastElementChild);
    act(() => regenerate.click());
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it('keeps the live region mounted while announcing lifecycle transitions', () => {
    renderPreview({});
    const liveStatus = host?.querySelector('[data-testid="og-generation-live-status"]');
    expect(liveStatus?.textContent).toBe('');

    renderPreview({ generationStatus: 'queued' });
    expect(host?.querySelector('[data-testid="og-generation-live-status"]')).toBe(liveStatus);
    expect(liveStatus?.textContent).toBe('Queued');

    renderPreview({ generationStatus: 'processing' });
    expect(host?.querySelector('[data-testid="og-generation-live-status"]')).toBe(liveStatus);
    expect(liveStatus?.textContent).toBe('Processing');
  });

  it('reveals the localized status tooltip to keyboard focus', async () => {
    renderPreview({ generationStatus: 'ready' });

    const statusIcon = host?.querySelector<HTMLElement>('[data-testid="og-generation-status-icon"]');
    expect(statusIcon?.getAttribute('tabindex')).toBe('0');
    await act(async () => {
      statusIcon?.focus();
      await new Promise((resolve) => setTimeout(resolve, 120));
    });

    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe('Ready');
  });

  it('keeps lookup errors visible as a focusable failed status icon without adding a row', () => {
    renderPreview({ generationError: 'Failed to load latest OG generation' });

    const statusIcon = host?.querySelector('[data-testid="og-generation-status-icon"]');
    expect(statusIcon?.getAttribute('data-status')).toBe('failed');
    expect(statusIcon?.getAttribute('aria-label')).toBe('Failed: Failed to load latest OG generation');
    expect(host?.querySelector('[data-testid="og-generation-live-status"]')?.textContent).toBe(
      'Failed: Failed to load latest OG generation',
    );
    expect(host?.querySelector('[data-testid="og-generation-live-status"]')?.getAttribute('aria-live')).toBe(
      'assertive',
    );
    expect(host?.querySelector('[data-testid="og-generation-error"]')).toBeNull();
  });

  it.each([
    ['failed', 'The renderer rejected this target', 'Failed'],
    ['cancelled', 'The document was deleted', 'Cancelled'],
  ] as const)(
    'moves the server error into the %s tooltip and keeps an explicit regenerate action',
    (status, error, label) => {
      const onRegenerate = vi.fn();
      renderPreview({
        canRegenerate: true,
        generationStatus: status,
        generationError: error,
        onRegenerate,
      });

      const statusLabel = `${label}: ${error}`;
      expect(host?.querySelector('[data-testid="og-generation-status-icon"]')?.getAttribute('aria-label')).toBe(
        statusLabel,
      );
      expect(host?.querySelector('[data-testid="og-generation-live-status"]')?.textContent).toBe(statusLabel);
      expect(host?.querySelector('[data-testid="og-generation-live-status"]')?.getAttribute('aria-live')).toBe(
        'assertive',
      );
      expect(host?.querySelector('[data-testid="og-generation-error"]')).toBeNull();
      const regenerate = host?.querySelector<HTMLButtonElement>('[aria-label="Regenerate OG Image"]');
      expect(regenerate).not.toBeNull();
      act(() => regenerate?.click());
      expect(onRegenerate).toHaveBeenCalledTimes(1);
    },
  );
});
