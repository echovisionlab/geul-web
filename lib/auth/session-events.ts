export const SESSION_INVALIDATED_EVENT = 'geul:session-invalidated';

export function notifySessionInvalidated(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new Event(SESSION_INVALIDATED_EVENT));
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
