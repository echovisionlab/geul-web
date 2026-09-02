// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
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
    root.render(<MantineProvider>{node}</MantineProvider>);
  });

  const alert = container.querySelector<HTMLElement>('[role="alert"]');
  if (!alert) {
    throw new Error('Expected Alert to render an alert element.');
  }
  return alert;
}

describe('Alert', () => {
  it('renders title and content with the default semantic info treatment', () => {
    const alert = renderAlert(<Alert title="Heads up">Review the latest changes.</Alert>);

    expect(alert.textContent).toContain('Heads up');
    expect(alert.textContent).toContain('Review the latest changes.');
    expect(alert.getAttribute('data-tone')).toBe('accent');
    expect(alert.getAttribute('data-prominence')).toBe('standard');
    expect(alert.getAttribute('data-variant')).toBe('light');
  });

  it('maps semantic danger tone to the controlled Mantine treatment', () => {
    const alert = renderAlert(<Alert tone="danger">Unable to save.</Alert>);

    expect(alert.getAttribute('data-tone')).toBe('danger');
    expect(alert.style.getPropertyValue('--alert-color')).toContain('red');
  });

  it('supports strong semantic prominence without exposing a raw variant', () => {
    const alert = renderAlert(
      <Alert tone="warning" prominence="strong">
        Preview mode
      </Alert>,
    );

    expect(alert.getAttribute('data-variant')).toBe('filled');
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
