// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface MutationResult {
  success: boolean;
  message: string;
}

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  pending: false,
  notificationsShow: vi.fn(),
  setCurrentUserNewsletterSubscriptionAction: vi.fn(),
  mutationOptions: null as null | {
    mutationFn: (subscribed: boolean) => Promise<MutationResult>;
    onSuccess: (result: MutationResult, subscribed: boolean) => void;
    onError: (error: unknown) => void;
  },
  viewProps: null as null | {
    subscribed: boolean;
    pending: boolean;
    error: string | null;
    labels: Record<string, string>;
    events: {
      onSubscriptionChange: (subscribed: boolean) => void;
    };
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: (options: NonNullable<typeof mocks.mutationOptions>) => {
    mocks.mutationOptions = options;
    return { mutate: mocks.mutate, isPending: mocks.pending };
  },
}));

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

vi.mock('@mantine/notifications', () => ({
  notifications: { show: mocks.notificationsShow },
}));

vi.mock('@/features/my/ui/SettingsForm', () => ({
  SettingsFormView: (props: NonNullable<typeof mocks.viewProps>) => {
    mocks.viewProps = props;
    return null;
  },
}));

vi.mock('@/lib/actions/newsletter', () => ({
  setCurrentUserNewsletterSubscriptionAction: mocks.setCurrentUserNewsletterSubscriptionAction,
}));

import { SettingsForm } from './SettingsForm';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.pending = false;
  mocks.mutationOptions = null;
  mocks.viewProps = null;
  mocks.mutate.mockReset();
  mocks.notificationsShow.mockReset();
  mocks.setCurrentUserNewsletterSubscriptionAction.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderController(subscribed = true) {
  act(() => {
    root.render(<SettingsForm initialSettings={{ subscribed }} />);
  });
}

function getViewProps() {
  expect(mocks.viewProps).not.toBeNull();
  return mocks.viewProps!;
}

function getMutationOptions() {
  expect(mocks.mutationOptions).not.toBeNull();
  return mocks.mutationOptions!;
}

describe('SettingsForm controller', () => {
  it('maps localized display props and subscription commands to the mutation', async () => {
    renderController();

    expect(getViewProps()).toMatchObject({
      subscribed: true,
      pending: false,
      error: null,
      labels: {
        subscribedAlert: 'settings.newsletter.subscribedAlert',
        unsubscribedAlert: 'settings.newsletter.unsubscribedAlert',
        subscribe: 'settings.newsletter.subscribe',
        unsubscribe: 'settings.newsletter.unsubscribe',
        footer: 'settings.newsletter.footer',
        errorTitle: 'common.labels.error',
      },
    });

    act(() => getViewProps().events.onSubscriptionChange(false));
    expect(mocks.mutate).toHaveBeenCalledWith(false);

    mocks.setCurrentUserNewsletterSubscriptionAction.mockResolvedValue({ success: true, message: 'Subscribed.' });
    await expect(getMutationOptions().mutationFn(true)).resolves.toEqual({
      success: true,
      message: 'Subscribed.',
    });
    expect(mocks.setCurrentUserNewsletterSubscriptionAction).toHaveBeenCalledWith(true);
  });

  it('updates the view and emits status-specific notifications after successful commands', () => {
    renderController(false);

    act(() => {
      getMutationOptions().onSuccess({ success: true, message: 'Subscription enabled.' }, true);
    });
    expect(getViewProps().subscribed).toBe(true);
    expect(getViewProps().error).toBeNull();
    expect(mocks.notificationsShow).toHaveBeenLastCalledWith({
      title: 'settings.newsletter.subscribedTitle',
      message: 'Subscription enabled.',
      color: 'green',
      icon: expect.any(Object),
    });

    act(() => {
      getMutationOptions().onSuccess({ success: true, message: 'Subscription disabled.' }, false);
    });
    expect(getViewProps().subscribed).toBe(false);
    expect(mocks.notificationsShow).toHaveBeenLastCalledWith({
      title: 'common.statuses.unsubscribed',
      message: 'Subscription disabled.',
      color: 'blue',
    });
  });

  it('exposes returned and thrown failures without changing the subscription state', () => {
    renderController(true);

    act(() => {
      getMutationOptions().onSuccess({ success: false, message: 'Returned failure.' }, false);
    });
    expect(getViewProps().subscribed).toBe(true);
    expect(getViewProps().error).toBe('Returned failure.');
    expect(mocks.notificationsShow).toHaveBeenLastCalledWith({
      title: 'common.labels.error',
      message: 'Returned failure.',
      color: 'red',
    });

    act(() => getMutationOptions().onError(new Error('Thrown failure.')));
    expect(getViewProps().subscribed).toBe(true);
    expect(getViewProps().error).toBe('Thrown failure.');
    expect(mocks.notificationsShow).toHaveBeenLastCalledWith({
      title: 'common.labels.error',
      message: 'Thrown failure.',
      color: 'red',
    });
  });
});
