// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { SettingsFormView, type SettingsFormViewLabels, type SettingsFormViewProps } from './SettingsFormView';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const labels: SettingsFormViewLabels = {
  subscribedAlert: 'You are subscribed.',
  unsubscribedAlert: 'You are not subscribed.',
  subscribe: 'Subscribe to newsletter',
  unsubscribe: 'Unsubscribe from emails',
  footer: 'Required account messages are always sent.',
  errorTitle: 'Error',
};

const onSubscriptionChange = vi.fn();
let container: HTMLDivElement;
let root: Root;

const defaultProps: SettingsFormViewProps = {
  subscribed: true,
  labels,
  events: { onSubscriptionChange },
};

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  onSubscriptionChange.mockReset();
});

function renderView(overrides: Partial<SettingsFormViewProps> = {}) {
  act(() => {
    root.render(
      <MantineProvider>
        <SettingsFormView {...defaultProps} {...overrides} />
      </MantineProvider>,
    );
  });
}

describe('SettingsFormView', () => {
  it('renders the subscribed state and forwards an unsubscribe intent through Core Button', () => {
    renderView();

    expect(container.querySelector('[data-subscription-state]')?.getAttribute('data-subscription-state')).toBe(
      'subscribed',
    );
    expect(container.textContent).toContain(labels.subscribedAlert);

    const button = container.querySelector<HTMLButtonElement>('button');
    expect(button?.textContent).toContain(labels.unsubscribe);
    expect(button?.dataset.tone).toBe('neutral');
    expect(button?.dataset.emphasis).toBe('medium');

    act(() => button?.click());
    expect(onSubscriptionChange).toHaveBeenCalledWith(false);
  });

  it('renders the unsubscribed state and forwards a subscribe intent', () => {
    renderView({ subscribed: false });

    expect(container.textContent).toContain(labels.unsubscribedAlert);
    const button = container.querySelector<HTMLButtonElement>('button');
    expect(button?.textContent).toContain(labels.subscribe);
    expect(button?.dataset.tone).toBe('accent');
    expect(button?.dataset.emphasis).toBe('strong');

    act(() => button?.click());
    expect(onSubscriptionChange).toHaveBeenCalledWith(true);
  });

  it('renders an external error and blocks repeated commands while pending or disabled', () => {
    renderView({ subscribed: false, pending: true, error: 'Subscription update failed.' });

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Subscription update failed.');
    const pendingButton = container.querySelector<HTMLButtonElement>('button');
    expect(pendingButton?.disabled).toBe(true);

    act(() => pendingButton?.click());
    expect(onSubscriptionChange).not.toHaveBeenCalled();

    renderView({ disabled: true });
    expect(container.querySelector<HTMLButtonElement>('button')?.disabled).toBe(true);
  });
});
