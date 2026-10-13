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
  it('owns the fitted body layout and rejects unknown runtime layout values', () => {
    const renderLayout = (bodyLayout: 'scroll' | 'fit') =>
      renderModal(
        <ContentModal opened onClose={() => undefined} title="Crop" closeLabel="Close" bodyLayout={bodyLayout}>
          <p>Resizable media</p>
        </ContentModal>,
      );
    renderLayout('fit');
    expect(document.body.querySelector('[data-body-layout="fit"]')).not.toBeNull();
    renderLayout('hidden' as 'fit');
    expect(document.body.querySelector('[data-body-layout="scroll"]')).not.toBeNull();
    expect(document.body.querySelector('[data-body-layout="hidden"]')).toBeNull();
  });

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

  it('defaults to compact density while keeping width and standard density independent', () => {
    const view = (density?: 'standard' | 'compact') => (
      <ContentModal opened onClose={() => {}} title="Details" closeLabel="Close details" size="large" density={density}>
        Details body
      </ContentModal>
    );
    renderModal(view());
    expect(document.body.querySelector('[data-density="compact"][data-size="large"]')).not.toBeNull();
    renderModal(view('standard'));
    expect(document.body.querySelector('[data-density="standard"][data-size="large"]')).not.toBeNull();
    expect(document.body.querySelector('[role="dialog"]')).toHaveAccessibleName('Details');
    renderModal(view('roomy' as 'compact'));
    expect(document.body.querySelector('[data-density="compact"][data-size="large"]')).not.toBeNull();
    expect(document.body.querySelector('[data-density="roomy"]')).toBeNull();
  });

  it('provides compact density through its shared owner without losing dialog dismissal', () => {
    const onClose = vi.fn();
    renderModal(
      <ContentModal opened onClose={onClose} title="Upload" closeLabel="Close" size="compact" density="compact">
        <button type="button">Browse</button>
      </ContentModal>,
    );
    expect(document.body.querySelector('[data-size="compact"][data-density="compact"]')).not.toBeNull();
    const close = document.body.querySelector<HTMLButtonElement>('[aria-label="Close"]');
    act(() => close?.click());
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('provides a viewport-bounded wide size for dense content', () => {
    renderModal(
      <ContentModal opened onClose={() => undefined} title="File library" closeLabel="Close" size="wide">
        <p>Files</p>
      </ContentModal>,
    );

    const modalRoot = document.body.querySelector<HTMLElement>('[data-size="wide"]');
    expect(modalRoot).not.toBeNull();
  });

  it('provides a near-full viewport workspace size with a fixed desktop inset', () => {
    renderModal(
      <ContentModal opened onClose={() => undefined} title="File library" closeLabel="Close" size="workspace">
        <p>Files</p>
      </ContentModal>,
    );

    const modalRoot = document.body.querySelector<HTMLElement>('[data-size="workspace"]');
    expect(modalRoot).not.toBeNull();
  });
});
