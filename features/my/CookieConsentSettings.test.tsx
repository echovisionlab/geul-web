// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import type { persistCurrentUserCookieConsentAction } from '@/lib/actions/cookie-consent';
import {
  COOKIE_CONSENT_COOKIE_NAME,
  COOKIE_CONSENT_VERSION,
  getCookieValue,
  parseCookieConsentPreferences,
} from '@/lib/cookie-consent';
import { CookieConsentSettings } from './CookieConsentSettings';

const notifications = vi.hoisted(() => ({ show: vi.fn() }));
vi.mock('@/components/core/Notification', () => ({ notifications }));
vi.mock('@/lib/actions/cookie-consent', () => ({ persistCurrentUserCookieConsentAction: vi.fn() }));

let host: HTMLDivElement;
let root: Root;
function consent() {
  return parseCookieConsentPreferences(getCookieValue(document.cookie, COOKIE_CONSENT_COOKIE_NAME));
}
function button(label: string) {
  const target = [...host.querySelectorAll<HTMLButtonElement>('button')].find((item) => item.textContent === label);
  if (!target) {
    throw new Error(`Missing button: ${label}`);
  }
  return target;
}
async function mount(persistAction: typeof persistCurrentUserCookieConsentAction) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <TestProviders>
        <CookieConsentSettings initialAnalytics={null} initialUpdatedAt={null} persistAction={persistAction} />
      </TestProviders>,
    );
  });
}

beforeEach(() => {
  document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=; Path=/; Max-Age=0`;
  notifications.show.mockClear();
});
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=; Path=/; Max-Age=0`;
});

describe('CookieConsentSettings single optional choice', () => {
  it('shows one optional switch and two equally sized neutral decisions', async () => {
    await mount(vi.fn(async () => ({ success: true, persisted: false })));
    expect(host.querySelectorAll('[role="switch"]')).toHaveLength(1);
    expect(host.querySelector('[role="switch"]')).not.toBeChecked();
    expect(host.textContent).toContain('Essential cookies are always active');
    expect(host.querySelectorAll('button')).toHaveLength(2);
    for (const control of host.querySelectorAll('button')) {
      expect(control).toHaveAttribute('data-size', 'xs');
      expect(control).toHaveAttribute('data-emphasis', 'medium');
      expect(control).toHaveAttribute('data-control-size', 'xs');
    }
  });

  it('does not persist a draft toggle and saves the selected value explicitly', async () => {
    const persist = vi.fn(async () => ({ success: true, persisted: false }));
    await mount(persist);
    act(() => host.querySelector<HTMLInputElement>('[role="switch"]')!.click());
    expect(consent()).toBeNull();
    expect(persist).not.toHaveBeenCalled();
    await act(async () => button('Save preferences').click());
    expect(persist).toHaveBeenCalledWith({ analytics: true, source: 'my_settings', version: COOKIE_CONSENT_VERSION });
    expect(consent()).toMatchObject({ essential: true, analytics: true });
    // Without an account session the choice is not synced, and the confirmation says so.
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'positive', message: 'Saved in this browser' }),
    );
  });

  it('rejects a selected draft while retaining browser persistence and the account error notice', async () => {
    const persist = vi.fn(async () => ({ success: false, persisted: false, error: 'Local sync failed' }));
    await mount(persist);
    act(() => host.querySelector<HTMLInputElement>('[role="switch"]')!.click());
    await act(async () => button('Reject').click());
    expect(persist).toHaveBeenCalledWith({ analytics: false, source: 'my_settings', version: COOKIE_CONSENT_VERSION });
    expect(consent()).toMatchObject({ essential: true, analytics: false });
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'danger', message: 'Local sync failed' }),
    );
  });
});
