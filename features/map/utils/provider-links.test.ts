// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MapRendererPlace } from '../types';
import { MAP_LINK_PROVIDERS, openMapProviderLink } from './provider-links';

const place: MapRendererPlace = {
  id: 'place-1',
  name: 'Custom Studio',
  address: 'Seoul',
  lat: 37.5665,
  lng: 126.978,
};

function setNavigatorState({
  userAgent,
  platform,
  maxTouchPoints,
}: {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
}) {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: userAgent,
  });
  Object.defineProperty(window.navigator, 'platform', {
    configurable: true,
    value: platform,
  });
  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    configurable: true,
    value: maxTouchPoints,
  });
}

beforeEach(() => {
  setNavigatorState({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)',
    platform: 'MacIntel',
    maxTouchPoints: 0,
  });
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'visible',
  });
  Object.defineProperty(document, 'hasFocus', {
    configurable: true,
    value: vi.fn(() => true),
  });
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('MAP_LINK_PROVIDERS', () => {
  it('builds a Google place link from exact coordinates when no place id exists', () => {
    const google = MAP_LINK_PROVIDERS.find((provider) => provider.id === 'google');

    expect(google).toBeDefined();

    const link = google!.buildPlaceLink(place);
    const url = new URL(link.webUrl);

    expect(link.label).toBe('Google Maps');
    expect(link.provider).toBe('google');
    expect(url.searchParams.get('api')).toBe('1');
    expect(url.searchParams.get('query')).toBe('37.5665,126.978');
    expect(link.appUrl).toBeDefined();

    const appUrl = new URL(link.appUrl!);

    expect(appUrl.protocol).toBe('comgooglemaps:');
    expect(appUrl.searchParams.get('center')).toBe('37.5665,126.978');
    expect(appUrl.searchParams.get('q')).toBe('37.5665,126.978');
  });

  it('does not put custom site-only place names into the Google search query', () => {
    const google = MAP_LINK_PROVIDERS.find((provider) => provider.id === 'google');

    expect(google).toBeDefined();

    const link = google!.buildPlaceLink({
      name: 'Polarfront Lab',
      lat: 37.539639,
      lng: 126.9904063,
    });
    const url = new URL(link.webUrl);

    expect(url.searchParams.get('query')).toBe('37.539639,126.9904063');
    expect(link.webUrl).not.toContain('Polarfront');
  });

  it('prefers a Google place id for the web URL when provided', () => {
    const google = MAP_LINK_PROVIDERS.find((provider) => provider.id === 'google');

    expect(google).toBeDefined();

    const link = google!.buildPlaceLink({
      ...place,
      googlePlaceId: 'ChIJm7YJp4uifDURkDgW8Kx8YpA',
    });
    const url = new URL(link.webUrl);
    const appUrl = new URL(link.appUrl!);

    expect(url.pathname).toBe('/maps/search/');
    expect(url.searchParams.get('api')).toBe('1');
    expect(url.searchParams.get('query')).toBe('Custom Studio');
    expect(url.searchParams.get('query_place_id')).toBe('ChIJm7YJp4uifDURkDgW8Kx8YpA');
    expect(appUrl.searchParams.get('q')).toBe('place_id:ChIJm7YJp4uifDURkDgW8Kx8YpA');
  });

  it('builds a Naver place link with exact coordinates and custom title', () => {
    const naver = MAP_LINK_PROVIDERS.find((provider) => provider.id === 'naver');

    expect(naver).toBeDefined();

    const link = naver!.buildPlaceLink(place);

    expect(link.label).toBe('Naver Maps');
    expect(link.provider).toBe('naver');
    expect(link.appUrl).toContain('nmap://place?lat=37.5665&lng=126.978');
    expect(link.appUrl).toContain('name=Custom%20Studio');
    const url = new URL(link.webUrl);
    expect(url.pathname).toBe('/');
    expect(url.searchParams.get('lat')).toBe('37.5665');
    expect(url.searchParams.get('lng')).toBe('126.978');
    expect(url.searchParams.get('title')).toBe('Custom Studio');
  });
});

describe('openMapProviderLink', () => {
  it('opens Google Maps in a new tab on desktop', () => {
    const link = {
      provider: 'google' as const,
      label: 'Google Maps',
      appUrl: '#google-app',
      webUrl: '#google-web',
    };
    const windowOpen = vi.fn();

    window.open = windowOpen;

    openMapProviderLink(link);

    expect(windowOpen).toHaveBeenCalledWith(link.webUrl, '_blank', 'noopener,noreferrer');
    expect(window.location.hash).toBe('');
  });

  it('tries the Google Maps iOS app first and falls back to the web URL on mobile', () => {
    vi.useFakeTimers();
    setNavigatorState({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
      platform: 'iPhone',
      maxTouchPoints: 5,
    });
    const link = {
      provider: 'google' as const,
      label: 'Google Maps',
      appUrl: '#google-app',
      webUrl: '#google-web',
    };

    openMapProviderLink(link);

    expect(window.location.hash).toBe('#google-app');

    vi.advanceTimersByTime(1600);

    expect(window.location.hash).toBe('#google-web');
  });

  it('keeps Android Google Maps opens on the web URL path', () => {
    setNavigatorState({
      userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/136.0.0.0 Mobile Safari/537.36',
      platform: 'Linux armv81',
      maxTouchPoints: 5,
    });
    const link = {
      provider: 'google' as const,
      label: 'Google Maps',
      appUrl: '#google-app',
      webUrl: '#google-web',
    };

    openMapProviderLink(link);

    expect(window.location.hash).toBe('#google-web');
  });
});
