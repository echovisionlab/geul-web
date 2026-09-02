export const COOKIE_CONSENT_COOKIE_NAME = 'geul_cookie_consent';
export const COOKIE_CONSENT_CHANGE_EVENT = 'geul:cookie-consent-change';
export const COOKIE_CONSENT_OPEN_EVENT = 'geul:cookie-consent-open';
export const COOKIE_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year
export const COOKIE_CONSENT_VERSION = 1;
const EXPIRED_COOKIE_DATE = 'Thu, 01 Jan 1970 00:00:00 GMT';

export interface CookieConsentPreferences {
  version: number;
  essential: true;
  analytics: boolean;
  updatedAt: string;
}

export function buildCookieConsentPreferences(analytics: boolean): CookieConsentPreferences {
  return {
    version: COOKIE_CONSENT_VERSION,
    essential: true,
    analytics,
    updatedAt: new Date().toISOString(),
  };
}

export function serializeCookieConsentPreferences(preferences: CookieConsentPreferences): string {
  return encodeURIComponent(JSON.stringify(preferences));
}

export function parseCookieConsentPreferences(rawValue: string | null | undefined): CookieConsentPreferences | null {
  if (!rawValue) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(rawValue);
    const parsed = JSON.parse(decoded) as Partial<CookieConsentPreferences>;

    if (parsed.essential !== true) {
      return null;
    }
    if (typeof parsed.analytics !== 'boolean') {
      return null;
    }
    if (typeof parsed.updatedAt !== 'string') {
      return null;
    }

    return {
      version:
        typeof parsed.version === 'number' && Number.isFinite(parsed.version)
          ? Math.max(0, Math.trunc(parsed.version))
          : 0,
      essential: true,
      analytics: parsed.analytics,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function getCookieValue(cookieHeader: string, cookieName: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  const prefix = `${cookieName}=`;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return trimmed.slice(prefix.length);
    }
  }

  return null;
}

export function hasAnalyticsConsent(preferences: CookieConsentPreferences | null): boolean {
  return preferences?.analytics === true;
}

export function isCookieConsentCurrent(
  preferences: CookieConsentPreferences | null,
  expectedVersion: number = COOKIE_CONSENT_VERSION,
): boolean {
  return !!preferences && preferences.version === expectedVersion;
}

export function hasValidAnalyticsConsent(preferences: CookieConsentPreferences | null): boolean {
  return hasAnalyticsConsent(preferences) && isCookieConsentCurrent(preferences);
}

function shouldSetDomain(hostname: string): boolean {
  if (!hostname || hostname === 'localhost') {
    return false;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return false;
  }
  return !hostname.includes(':'); // IPv6 or invalid domain notation
}

function buildCookieDomains(hostname: string): string[] {
  if (!shouldSetDomain(hostname)) {
    return [];
  }

  const labels = hostname.split('.').filter(Boolean);
  if (labels.length < 2) {
    return [];
  }

  const domains: string[] = [];
  for (let i = 0; i <= labels.length - 2; i += 1) {
    domains.push(labels.slice(i).join('.'));
  }
  return domains;
}

function expireCookie(name: string, domain?: string) {
  let cookie = `${name}=; Path=/; Expires=${EXPIRED_COOKIE_DATE}; Max-Age=0; SameSite=Lax`;
  if (domain) {
    cookie += `; Domain=${domain}`;
  }
  document.cookie = cookie;
}

export function clearGoogleAnalyticsCookies(measurementId?: string): void {
  if (typeof document === 'undefined') {
    return;
  }

  const cookieNames = document.cookie
    .split(';')
    .map((part) => part.trim().split('=')[0])
    .filter(Boolean);

  const targets = new Set<string>();
  for (const name of cookieNames) {
    if (
      name === '_ga' ||
      name === '_gid' ||
      name === '_gat' ||
      name.startsWith('_ga_') ||
      name.startsWith('_gid_') ||
      name.startsWith('_gat_') ||
      name.startsWith('_gac_')
    ) {
      targets.add(name);
    }
  }

  if (measurementId) {
    const normalizedId = measurementId.replace(/-/g, '_');
    targets.add(`_ga_${normalizedId}`);
    targets.add(`_gat_gtag_${normalizedId}`);
    targets.add(`_gac_gb_${normalizedId}`);
  }

  const domains = buildCookieDomains(window.location.hostname);
  for (const name of targets) {
    expireCookie(name);
    for (const domain of domains) {
      expireCookie(name, domain);
    }
  }
}
