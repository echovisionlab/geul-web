export interface CookieLike {
  name: string;
  value: string;
}

export interface ExpireSessionCookieOptions {
  requestUrl: string | URL;
  sessionCookieNames: readonly string[];
}

const SESSION_COOKIE_EXPIRES_AT = 'Thu, 01 Jan 1970 00:00:00 GMT';
const IPV4_HOST_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

export function getSessionCookieNames(sessionCookieName: string): string[] {
  return [sessionCookieName];
}

export function buildCookieHeader(cookies: Iterable<CookieLike>): string {
  return Array.from(cookies, (cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

export function hasCookieNamed(cookieHeader: string, cookieNames: Iterable<string>): boolean {
  if (!cookieHeader) {
    return false;
  }

  const names = new Set(cookieNames);
  return cookieHeader.split(';').some((entry) => names.has(entry.trim().split('=')[0] ?? ''));
}

function getParentCookieDomain(hostname: string): string | null {
  if (!hostname || hostname === 'localhost' || IPV4_HOST_RE.test(hostname) || !hostname.includes('.')) {
    return null;
  }

  const labels = hostname.split('.');
  if (labels.length < 2) {
    return null;
  }

  return `.${labels.slice(-2).join('.')}`;
}

function buildExpiredSessionCookie(cookieName: string, domain: string | null, isSecure: boolean): string {
  const domainAttribute = domain ? `; Domain=${domain}` : '';
  const secureAttribute = isSecure ? '; Secure' : '';
  return `${cookieName}=; Path=/; Max-Age=0; Expires=${SESSION_COOKIE_EXPIRES_AT}; SameSite=Lax${domainAttribute}${secureAttribute}`;
}

export function appendExpiredSessionCookies(
  headers: Headers,
  { requestUrl, sessionCookieNames }: ExpireSessionCookieOptions,
): void {
  const url = requestUrl instanceof URL ? requestUrl : new URL(requestUrl);
  const parentDomain = getParentCookieDomain(url.hostname);
  const isSecure = url.protocol === 'https:';

  for (const cookieName of sessionCookieNames) {
    const isHostPrefixCookie = cookieName.startsWith('__Host-');
    headers.append('set-cookie', buildExpiredSessionCookie(cookieName, null, isSecure || isHostPrefixCookie));
    if (parentDomain && !isHostPrefixCookie) {
      headers.append('set-cookie', buildExpiredSessionCookie(cookieName, parentDomain, isSecure));
    }
  }
}
