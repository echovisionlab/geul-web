// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/render';
import {
  buildCookieConsentPreferences,
  COOKIE_CONSENT_CHANGE_EVENT,
  COOKIE_CONSENT_COOKIE_NAME,
  COOKIE_CONSENT_OPEN_EVENT,
  COOKIE_CONSENT_VERSION,
  getCookieValue,
  hasValidAnalyticsConsent,
  parseCookieConsentPreferences,
  serializeCookieConsentPreferences,
} from '@/lib/cookie-consent';
import enMessages from '@/messages/en.json';
import { CookieConsentBanner } from './CookieConsentBanner';
const mocks = vi.hoisted(() => ({
  pathname: '/',
  session: { data: null as null | { user: { id: string } }, isPending: false },
}));
vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }));
vi.mock('@/lib/auth/client', () => ({ useSession: () => mocks.session }));
let fetchMock: ReturnType<typeof vi.fn>;
const consent = () => parseCookieConsentPreferences(getCookieValue(document.cookie, COOKIE_CONSENT_COOKIE_NAME));
function writeConsent(analytics: boolean, version = COOKIE_CONSENT_VERSION) {
  document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=${serializeCookieConsentPreferences({ ...buildCookieConsentPreferences(analytics), version })}; Path=/`;
}
beforeEach(() => {
  document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=; Path=/; Max-Age=0`;
  mocks.pathname = '/';
  mocks.session = { data: null, isPending: false };
  fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ success: false, consent: null }) }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=; Path=/; Max-Age=0`;
  vi.unstubAllGlobals();
});
describe('CookieConsentBanner', () => {
  it('enables analytics only after explicit acceptance and publishes the decision once', async () => {
    const changed = vi.fn();
    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, changed);
    try {
      const { user } = render(<CookieConsentBanner />);
      expect(screen.queryByRole('switch')).not.toBeInTheDocument();
      expect(screen.getAllByRole('button')).toHaveLength(2);
      expect(consent()).toBeNull();
      expect(hasValidAnalyticsConsent(consent())).toBe(false);
      expect(changed).not.toHaveBeenCalled();
      await user.click(screen.getByRole('button', { name: 'Accept all' }));
      expect(consent()).toMatchObject({ essential: true, analytics: true, version: COOKIE_CONSENT_VERSION });
      expect(screen.queryByRole('button', { name: 'Accept all' })).not.toBeInTheDocument();
      expect(changed).toHaveBeenCalledTimes(1);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, changed);
    }
  });
  it('rejects optional analytics from the first layer', async () => {
    const { user } = render(<CookieConsentBanner />);
    await user.click(screen.getByRole('button', { name: 'Reject' }));
    expect(consent()).toMatchObject({ essential: true, analytics: false, version: COOKIE_CONSENT_VERSION });
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
  });
  it('requires an explicit renewal of outdated consent', async () => {
    writeConsent(true, COOKIE_CONSENT_VERSION - 1);
    const { user } = render(<CookieConsentBanner />);
    expect(screen.getByText(enMessages.cookieConsentBanner.renewalNotice)).toBeVisible();
    expect(hasValidAnalyticsConsent(consent())).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Accept all' }));
    expect(hasValidAnalyticsConsent(consent())).toBe(true);
  });
  it('focuses rejection when reopened and restores the invoking control after saving', async () => {
    writeConsent(true);
    const { user } = render(
      <>
        <button type="button" onClick={() => window.dispatchEvent(new Event(COOKIE_CONSENT_OPEN_EVENT))}>
          Cookie settings
        </button>
        <CookieConsentBanner />
      </>,
    );
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
    const origin = screen.getByRole('button', { name: 'Cookie settings' });
    await user.click(origin);
    expect(screen.getByRole('button', { name: 'Reject' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Accept all' }));
    expect(origin).toHaveFocus();
  });
  it('keeps the browser decision when account sync fails', async () => {
    mocks.session = { data: { user: { id: 'member' } }, isPending: false };
    fetchMock.mockImplementation(async (_url, options) => {
      if (options?.method === 'POST') {
        throw new Error('offline');
      }
      return { ok: true, json: async () => ({ success: false, consent: null }) };
    });
    const { user } = render(<CookieConsentBanner />);
    await user.click(await screen.findByRole('button', { name: 'Reject' }));
    const posts = fetchMock.mock.calls.filter((call) => call[1]?.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(JSON.parse(posts[0][1].body)).toEqual({
      analytics: false,
      version: COOKIE_CONSENT_VERSION,
      source: 'banner',
    });
    expect(consent()).toMatchObject({ essential: true, analytics: false });
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
  });
  it('does not let an old account read overwrite a newer explicit browser decision', async () => {
    mocks.session = { data: { user: { id: 'member' } }, isPending: false };
    let finish!: (response: unknown) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { user } = render(<CookieConsentBanner />);
    act(() => window.dispatchEvent(new Event(COOKIE_CONSENT_OPEN_EVENT)));
    await user.click(screen.getByRole('button', { name: 'Reject' }));
    await act(async () =>
      finish({
        ok: true,
        json: async () => ({
          success: true,
          consent: { essential: true, analytics: true, version: COOKIE_CONSENT_VERSION },
        }),
      }),
    );
    expect(consent()).toMatchObject({ analytics: false });
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
  });
  it.each(['/my/settings', '/login', '/verify', '/account/recovery'])('keeps the banner out of %s', (pathname) => {
    mocks.pathname = pathname;
    render(<CookieConsentBanner />);
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
  });
});
