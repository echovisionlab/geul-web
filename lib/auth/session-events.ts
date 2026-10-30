export const SESSION_INVALIDATED_EVENT = 'geul:session-invalidated';
export const SESSION_REVALIDATE_EVENT = 'geul:session-revalidate';

export function notifySessionInvalidated(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new Event(SESSION_INVALIDATED_EVENT));
}

/**
 * Asks the session provider to recheck the session now. Server Actions report a lost session as a
 * 401 result rather than a browser response, so their callers request the check instead of waiting
 * for the next interval.
 */
export function requestSessionRevalidation(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new Event(SESSION_REVALIDATE_EVENT));
}

export async function authenticatedBrowserFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    credentials: 'include',
  });
  if (response.status === 401) {
    notifySessionInvalidated();
  }
  return response;
}
