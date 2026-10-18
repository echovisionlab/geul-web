// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
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
import { CookieConsentBanner } from './CookieConsentBanner';

const mocks = vi.hoisted(() => ({
  pathname: '/',
  session: { data: null as null | { user: { id: string } }, isPending: false },
}));
vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }));
vi.mock('@/lib/auth/client', () => ({ useSession: () => mocks.session }));

let host: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;

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
async function mount() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <TestProviders>
        <CookieConsentBanner />
      </TestProviders>,
    );
  });
}
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
  act(() => root?.unmount());
  host?.remove();
  document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=; Path=/; Max-Age=0`;
  vi.unstubAllGlobals();
});

describe('CookieConsentBanner single optional choice', () => {
  it('does not enable analytics until explicit acceptance', async () => {
    const changed = vi.fn();
    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, changed);
    await mount();
    expect(host.querySelector('[role="switch"]')).toBeNull();
    expect(hasValidAnalyticsConsent(consent())).toBe(false);
    expect(host.querySelectorAll('button')).toHaveLength(2);
    expect(consent()).toBeNull();
    expect(consent()).toBeNull();
    expect(changed).not.toHaveBeenCalled();
    act(() => button('Accept all').click());
    expect(consent()).toMatchObject({ essential: true, analytics: true, version: COOKIE_CONSENT_VERSION });
    expect(host.querySelector('aside')).toBeNull();
    expect(changed).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, changed);
  });

  it('rejects optional analytics from the first layer', async () => {
    await mount();
    act(() => button('Reject').click());
    expect(consent()).toMatchObject({ essential: true, analytics: false, version: COOKIE_CONSENT_VERSION });
    expect(host.querySelector('aside')).toBeNull();
  });

  it('requires a new explicit decision for outdated consent', async () => {
    writeConsent(true, COOKIE_CONSENT_VERSION - 1);
    await mount();
    expect(host.querySelector('[data-testid="cookie-consent-renewal-notice"]')).toBeVisible();
    expect(host.textContent).toContain('essential cookies');
    expect(hasValidAnalyticsConsent(consent())).toBe(false);
    act(() => button('Accept all').click());
    expect(hasValidAnalyticsConsent(consent())).toBe(true);
  });

  it('focuses rejection on explicit reopening and returns focus to the invoking control after save', async () => {
    writeConsent(true);
    await mount();
    expect(host.querySelector('aside')).toBeNull();
    const origin = document.createElement('button');
    origin.textContent = 'Cookie settings';
    document.body.appendChild(origin);
    origin.focus();
    act(() => window.dispatchEvent(new Event(COOKIE_CONSENT_OPEN_EVENT)));
    expect(document.activeElement).toBe(button('Reject'));
    act(() => button('Accept all').click());
    expect(document.activeElement).toBe(origin);
    origin.remove();
  });

  it('keeps browser consent effective if account sync fails and sends only the chosen boolean', async () => {
    mocks.session = { data: { user: { id: 'member' } }, isPending: false };
    fetchMock.mockImplementation(async (_url, options) => {
      if (options?.method === 'POST') {
        throw new Error('Account sync unavailable');
      }
      return { ok: true, json: async () => ({ success: false, consent: null }) };
    });
    await mount();
    await act(async () => button('Reject').click());
    const posts = fetchMock.mock.calls.filter((call) => call[1]?.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(JSON.parse(posts[0]![1]!.body)).toEqual({
      analytics: false,
      version: COOKIE_CONSENT_VERSION,
      source: 'banner',
    });
    expect(consent()).toMatchObject({ essential: true, analytics: false });
    expect(host.querySelector('aside')).toBeNull();
  });

  it.each(['/my/settings', '/login', '/verify', '/account/recovery'])(
    'keeps the banner out of %s',
    async (pathname) => {
      mocks.pathname = pathname;
      await mount();
      expect(host.querySelector('aside')).toBeNull();
    },
  );
});
