import {
  buildGoogleMapProviderLink,
  buildNaverMapProviderLink,
  type MapLinkPlaceInput,
  type MapLinkProviderId,
  type MapProviderLinkData,
} from '@/lib/utils/map-provider-links';

export type MapLinkPlace = MapLinkPlaceInput;
export interface MapProviderLink extends MapProviderLinkData {}

export interface MapLinkProvider {
  id: MapLinkProviderId;
  label: string;
  buildPlaceLink: (place: MapLinkPlace) => MapProviderLink;
}

const MOBILE_APP_FALLBACK_DELAY_MS = 1600;
const MOBILE_USER_AGENT_PATTERN = /Android|iPhone|iPad|iPod|Windows Phone|Mobile/i;
const APPLE_MOBILE_USER_AGENT_PATTERN = /iPhone|iPad|iPod/i;

function isMobileDevice() {
  if (typeof navigator === 'undefined') {
    return false;
  }

  if (MOBILE_USER_AGENT_PATTERN.test(navigator.userAgent)) {
    return true;
  }

  return navigator.maxTouchPoints > 1 && navigator.platform === 'MacIntel';
}

function isAppleMobileDevice() {
  if (typeof navigator === 'undefined') {
    return false;
  }

  if (APPLE_MOBILE_USER_AGENT_PATTERN.test(navigator.userAgent)) {
    return true;
  }

  return navigator.maxTouchPoints > 1 && navigator.platform === 'MacIntel';
}

function openInCurrentTab(url: string) {
  window.location.assign(url);
}

function openInNewTab(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

function openWithAppFallback(appUrl: string, webUrl: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  let settled = false;
  let appLaunchDetected = false;

  const cleanup = () => {
    if (settled) {
      return;
    }

    settled = true;
    window.clearTimeout(fallbackTimer);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('pagehide', handlePageHide);
    window.removeEventListener('blur', handleBlur);
    document.removeEventListener('freeze', handleFreeze);
  };

  const markAppLaunchDetected = () => {
    appLaunchDetected = true;
    cleanup();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      markAppLaunchDetected();
    }
  };

  const handlePageHide = () => {
    markAppLaunchDetected();
  };

  const handleBlur = () => {
    markAppLaunchDetected();
  };

  const handleFreeze = () => {
    markAppLaunchDetected();
  };

  const fallbackTimer = window.setTimeout(() => {
    const pageStillActive =
      document.visibilityState === 'visible' && (typeof document.hasFocus !== 'function' || document.hasFocus());

    cleanup();

    if (!appLaunchDetected && pageStillActive) {
      openInCurrentTab(webUrl);
    }
  }, MOBILE_APP_FALLBACK_DELAY_MS);

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pagehide', handlePageHide);
  window.addEventListener('blur', handleBlur);
  document.addEventListener('freeze', handleFreeze);
  openInCurrentTab(appUrl);
}

function buildGooglePlaceLink(place: MapLinkPlace): MapProviderLink {
  return buildGoogleMapProviderLink(place);
}

function buildNaverPlaceLink(place: MapLinkPlace): MapProviderLink {
  return buildNaverMapProviderLink(place);
}

export const MAP_LINK_PROVIDERS: MapLinkProvider[] = [
  {
    id: 'google',
    label: 'Google Maps',
    buildPlaceLink: buildGooglePlaceLink,
  },
  {
    id: 'naver',
    label: 'Naver Maps',
    buildPlaceLink: buildNaverPlaceLink,
  },
];

export function openMapProviderLink(link: MapProviderLink) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!isMobileDevice()) {
    openInNewTab(link.webUrl);
    return;
  }

  const shouldUseAppFallback =
    !!link.appUrl && (link.provider === 'naver' || (link.provider === 'google' && isAppleMobileDevice()));

  if (shouldUseAppFallback) {
    openWithAppFallback(link.appUrl!, link.webUrl);
    return;
  }

  openInCurrentTab(link.webUrl);
}
