// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import enMessages from '@/messages/en.json';
import { LoginErrorPageView } from './LoginErrorPageView';
import { LoginStatusView } from './ui/LoginStatusView';

// This suite verifies actual return actions; animated code rendering has its own owner tests.
vi.mock('@/features/application-error/ErrorCodeParticles', () => ({
  ErrorCodeParticles: ({ code }: { code: string }) => <span aria-hidden>{code}</span>,
}));

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('authentication return actions', () => {
  it.each([null, { id: 'session_inactive' }, { id: 'account_pending_deletion' }])(
    'preserves the named login destination without an arrow for error %j',
    (error) => {
      act(() =>
        root.render(
          <TestProviders>
            <LoginErrorPageView error={error} />
          </TestProviders>,
        ),
      );
      const back = host.querySelector<HTMLAnchorElement>('a[href="/login"]')!;
      expect(back).toHaveAccessibleName(enMessages.common.actions.backToLogin);
      expect(back.querySelector('svg')).toBeNull();
      act(() => back.focus());
      expect(back).toHaveFocus();
      expect(host.querySelector('a[href="/"]')).not.toBeNull();
      if (error?.id === 'account_pending_deletion') {
        expect(host.querySelector('a[href="/account/recover"]')).not.toBeNull();
      }
    },
  );

  it('retains login retry text, alert and destination without an accessory glyph', () => {
    act(() =>
      root.render(
        <TestProviders>
          <LoginStatusView kind="error" message="Please sign in again" retryHref="/login" retryLabel="Back to login" />
        </TestProviders>,
      ),
    );
    const back = host.querySelector<HTMLAnchorElement>('a[href="/login"]')!;
    expect(back).toHaveAccessibleName('Back to login');
    expect(back.querySelector('svg')).toBeNull();
    expect(host.querySelector('[role="alert"]')).toHaveTextContent('Please sign in again');
    act(() => back.focus());
    expect(back).toHaveFocus();
  });
});
