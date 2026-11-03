// @vitest-environment jsdom
import { act } from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/render';
import {
  COOKIE_CONSENT_COOKIE_NAME,
  COOKIE_CONSENT_VERSION,
  getCookieValue,
  parseCookieConsentPreferences,
} from '@/lib/cookie-consent';
import { NotificationHost, notifications } from '@/components/core/Notification';
import { CookieConsentSettings } from './CookieConsentSettings';
vi.mock('@/lib/actions/cookie-consent', () => ({ persistCurrentUserCookieConsentAction: vi.fn() }));
function consent() {
  return parseCookieConsentPreferences(getCookieValue(document.cookie, COOKIE_CONSENT_COOKIE_NAME));
}
beforeEach(() => {
  document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=; Path=/; Max-Age=0`;
});
afterEach(() => {
  act(() => notifications.clean());
  document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=; Path=/; Max-Age=0`;
});
describe('CookieConsentSettings', () => {
  it('shows one optional choice and saves only the explicit decision', async () => {
    const persist = vi.fn(async () => ({ success: true, persisted: false }));
    const { user } = render(
      <>
        <NotificationHost closeLabel="Close notification" loading="eager" />
        <CookieConsentSettings initialAnalytics={null} initialUpdatedAt={null} persistAction={persist} />
      </>,
    );
    expect(screen.getAllByRole('switch')).toHaveLength(1);
    expect(screen.getByRole('switch')).not.toBeChecked();
    expect(screen.getAllByRole('button')).toHaveLength(2);
    for (const control of screen.getAllByRole('button')) {
      expect(control).toHaveAttribute('data-size', 'xs');
      expect(control).toHaveAttribute('data-emphasis', 'medium');
      expect(control).toHaveAttribute('data-control-size', 'xs');
    }
    expect(screen.getByText(/Essential cookies are always active/)).toBeVisible();
    await user.click(screen.getByRole('switch'));
    expect(consent()).toBeNull();
    expect(persist).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Save preferences' }));
    expect(persist).toHaveBeenCalledWith({ analytics: true, source: 'my_settings', version: COOKIE_CONSENT_VERSION });
    expect(consent()).toMatchObject({ essential: true, analytics: true });
    expect(await screen.findByText('Saved in this browser')).toBeVisible();
  });
  it('keeps the browser decision on account failure and marks only the initiating action pending', async () => {
    let finish!: (value: { success: boolean; persisted: boolean; error: string }) => void;
    const persist = vi.fn(
      () =>
        new Promise<{ success: boolean; persisted: boolean; error: string }>((resolve) => {
          finish = resolve;
        }),
    );
    const { user } = render(
      <>
        <NotificationHost closeLabel="Close notification" loading="eager" />
        <CookieConsentSettings initialAnalytics={null} initialUpdatedAt={null} persistAction={persist} />
      </>,
    );
    await user.click(screen.getByRole('switch'));
    await user.click(screen.getByRole('button', { name: 'Reject' }));
    expect(screen.getByRole('button', { name: 'Reject' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Save preferences' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save preferences' })).not.toHaveAttribute('aria-busy', 'true');
    expect(consent()).toMatchObject({ essential: true, analytics: false });
    await act(async () => finish({ success: false, persisted: false, error: 'Local sync failed' }));
    expect(await screen.findByText('Local sync failed')).toBeVisible();
    expect(persist).toHaveBeenCalledWith({ analytics: false, source: 'my_settings', version: COOKIE_CONSENT_VERSION });
  });
});
