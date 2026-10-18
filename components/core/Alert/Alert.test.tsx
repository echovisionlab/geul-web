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
