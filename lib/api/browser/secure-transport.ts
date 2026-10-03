import { createConnectTransport } from '@connectrpc/connect-web';
import { authenticatedBrowserFetch } from '@/lib/auth/session-events';

const BROWSER_RPC_BASE_URL = '/api/rpc';

// Browser transport with cookie credentials for authenticated requests
export function createBrowserTransport() {
  return createConnectTransport({
    baseUrl: BROWSER_RPC_BASE_URL,
    fetch: authenticatedBrowserFetch,
  });
}
