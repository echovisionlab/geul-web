// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from 'react-aria-components';
import { ContentModal } from './ContentModal';

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
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
  vi.restoreAllMocks();
});

function renderModal(node: ReactNode) {
  act(() => {
    root?.render(<I18nProvider locale="en-US">{node}</I18nProvider>);
  });
}

describe('ContentModal', () => {
  it('owns accessible generic content-modal semantics without imposing a footer', () => {
    const onClose = vi.fn();
    renderModal(
      <ContentModal
        id="media-ingest-dialog"
        opened
        onClose={onClose}
        title="Add audio"
        closeLabel="Close dialog"
        centered
        size="large"
      >
        <p>Upload or import an audio file.</p>
      </ContentModal>,
    );

    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBeTruthy();
    expect(dialog?.textContent).toContain('Add audio');
    expect(dialog?.textContent).toContain('Upload or import an audio file.');
    expect(dialog?.querySelector('[aria-label="Close dialog"]')).not.toBeNull();
    const modalRoot = document.body.querySelector<HTMLElement>(
      '#media-ingest-dialog[data-size="large"][data-centered="true"]',
    );
    expect(modalRoot).not.toBeNull();
    expect(dialog?.querySelector('form')).toBeNull();
  });
});
