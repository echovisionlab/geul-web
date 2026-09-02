export const P5_RUNNER_PATH = '/tools/p5-runner';

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'localhost' || normalized === '[::1]' || /^127(?:\.\d{1,3}){3}$/u.test(normalized);
}

function cookieSiteHint(hostname: string): string {
  const labels = hostname.toLowerCase().replace(/\.$/u, '').split('.');
  return labels.length > 1 ? labels.slice(-2).join('.') : (labels[0] ?? '');
}

function usesAllowedProtocol(url: URL): boolean {
  return url.protocol === 'https:' || (url.protocol === 'http:' && isLoopbackHostname(url.hostname));
}

export function resolveP5ParentOrigin(rawValue: string | undefined): string | null {
  const value = rawValue?.trim();
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    if (url.username || url.password || !usesAllowedProtocol(url) || url.pathname !== '/' || url.search || url.hash) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Accepts only the dedicated runner route on a cookie-isolated origin. The
 * two-label comparison is intentionally conservative for public-suffix cases;
 * production must not place the runner below the site's cookie domain.
 */
export function resolveP5RunnerUrl(rawValue: string | undefined, parentOrigin: string): URL | null {
  const value = rawValue?.trim();
  if (!value) {
    return null;
  }
  try {
    const parent = new URL(parentOrigin);
    const runner = new URL(value);
    if (
      runner.username ||
      runner.password ||
      !usesAllowedProtocol(runner) ||
      runner.pathname !== P5_RUNNER_PATH ||
      runner.search ||
      runner.hash ||
      runner.origin === parent.origin
    ) {
      return null;
    }
    if (
      !isLoopbackHostname(parent.hostname) &&
      !isLoopbackHostname(runner.hostname) &&
      cookieSiteHint(parent.hostname) === cookieSiteHint(runner.hostname)
    ) {
      return null;
    }
    return runner;
  } catch {
    return null;
  }
}
