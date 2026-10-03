import { createConnectTransport } from '@connectrpc/connect-web';

const BROWSER_RPC_BASE_URL = '/api/rpc';

// Public transport without credentials for public APIs
export function createPublicBrowserTransport(acceptLanguageOverride?: string | null) {
  return createConnectTransport({
    baseUrl: BROWSER_RPC_BASE_URL,
    fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (acceptLanguageOverride) {
        headers.set('Accept-Language', acceptLanguageOverride);
      }
      return fetch(input, {
        ...init,
        headers,
      });
    },
  });
}
