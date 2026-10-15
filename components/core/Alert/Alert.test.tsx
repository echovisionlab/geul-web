// @vitest-environment jsdom

import { I18nProvider as DesignSystemProvider } from 'react-aria-components';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Alert } from './Alert';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderAlert(node: React.ReactNode): HTMLElement {
  act(() => {
    root.render(<DesignSystemProvider>{node}</DesignSystemProvider>);
  });

  const alert = container.querySelector<HTMLElement>('[role="alert"]');
  if (!alert) {
    throw new Error('Expected Alert to render an alert element.');
  }
  return alert;
}

describe('Alert', () => {
  it('renders title and content with the default neutral notice treatment', () => {
    const alert = renderAlert(<Alert title="Heads up">Review the latest changes.</Alert>);

    expect(alert.textContent).toContain('Heads up');
    expect(alert.textContent).toContain('Review the latest changes.');
    expect(alert.getAttribute('data-tone')).toBe('neutral');
    expect(alert.getAttribute('data-prominence')).toBe('standard');
    expect(alert.hasAttribute('data-variant')).toBe(false);
  });

  it('preserves negative feedback semantics for the shared themed presentation', () => {
    const alert = renderAlert(<Alert tone="danger">Unable to save.</Alert>);

    expect(alert.getAttribute('data-tone')).toBe('danger');
    expect(alert.textContent).toContain('Unable to save.');
    expect(alert.hasAttribute('style')).toBe(false);
  });

  it('supports strong semantic prominence without exposing a raw variant', () => {
    const alert = renderAlert(
      <Alert tone="warning" prominence="strong">
        Preview mode
      </Alert>,
    );

    expect(alert.getAttribute('data-tone')).toBe('warning');
    expect(alert.hasAttribute('data-variant')).toBe(false);
    expect(alert.getAttribute('data-prominence')).toBe('strong');
  });

  it('preserves close-button interaction behavior', () => {
    const onClose = vi.fn();
    renderAlert(
      <Alert withCloseButton closeButtonLabel="Dismiss" onClose={onClose}>
        Dismissible notice
      </Alert>,
    );

    const closeButton = container.querySelector<HTMLButtonElement>('button[aria-label="Dismiss"]');
    if (!closeButton) {
      throw new Error('Expected Alert to render a close button.');
    }

    act(() => closeButton.click());
    expect(onClose).toHaveBeenCalledOnce();
  });
});
