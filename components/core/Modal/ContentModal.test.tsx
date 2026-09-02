// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
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
    root?.render(<MantineProvider env="test">{node}</MantineProvider>);
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
    expect(dialog?.getAttribute('aria-labelledby')).toBeTruthy();
    expect(dialog?.textContent).toContain('Add audio');
    expect(dialog?.textContent).toContain('Upload or import an audio file.');
    expect(dialog?.querySelector('[aria-label="Close dialog"]')).not.toBeNull();
    const modalRoot = document.body.querySelector<HTMLElement>(
      '#media-ingest-dialog[data-size="large"][data-centered="true"]',
    );
    expect(modalRoot).not.toBeNull();
    expect(modalRoot?.style.getPropertyValue('--modal-radius')).toBe('0rem');
    expect(dialog?.querySelector('form')).toBeNull();
  });

  it('provides a viewport-bounded wide size for dense content', () => {
    renderModal(
      <ContentModal opened onClose={() => undefined} title="File library" closeLabel="Close" size="wide">
        <p>Files</p>
      </ContentModal>,
    );

    const modalRoot = document.body.querySelector<HTMLElement>('[data-size="wide"]');
    expect(modalRoot).not.toBeNull();
    expect(modalRoot?.style.getPropertyValue('--modal-size')).toBe('60rem');
    expect(modalRoot?.style.getPropertyValue('--modal-x-offset')).toBe('1rem');
  });

  it('provides a near-full viewport workspace size with a fixed desktop inset', () => {
    renderModal(
      <ContentModal opened onClose={() => undefined} title="File library" closeLabel="Close" size="workspace">
        <p>Files</p>
      </ContentModal>,
    );

    const modalRoot = document.body.querySelector<HTMLElement>('[data-size="workspace"]');
    expect(modalRoot).not.toBeNull();
    expect(modalRoot?.style.getPropertyValue('--modal-size')).toBe('calc(100vw - 3rem)');
    expect(modalRoot?.style.getPropertyValue('--modal-x-offset')).toBe('1.5rem');
    expect(modalRoot?.style.getPropertyValue('--modal-y-offset')).toBe('1.5rem');
    expect(document.body.querySelector('[role="dialog"]')?.className).toContain('workspaceContent');
  });
});
