import { getPublicAuthUrl } from '@/lib/public-runtime-config';
import { decodeBrowserFlowResponse, type BrowserFlowOutcome } from './auth-browser-transport';
import { asKratosBrowserFlow, type KratosBrowserFlow } from './kratos-flow';

export interface UnifiedLoginTransport {
  actionUrl: (flowId: string) => string;
  browserUrl: (returnTo?: string | null, refresh?: boolean) => string;
  load: (flowId: string, restartUrl: string) => Promise<BrowserFlowOutcome<KratosBrowserFlow>>;
  submit: (
    flowId: string,
    payload: Record<string, unknown>,
    restartUrl: string,
  ) => Promise<BrowserFlowOutcome<KratosBrowserFlow>>;
}

function unifiedLoginUrl(path = ''): URL {
  return new URL(`${getPublicAuthUrl()}/login${path}`, 'https://app.local');
}

function relativeUrl(url: URL): string {
  return `${url.pathname}${url.search}${url.hash}`;
}

export function createUnifiedLoginTransport(fetchFn: typeof fetch = fetch): UnifiedLoginTransport {
  const actionUrl = (flowId: string) => {
    const url = unifiedLoginUrl();
    url.searchParams.set('flow', flowId);
    return relativeUrl(url);
  };

  return {
    actionUrl,
    browserUrl(returnTo, refresh = false) {
      const url = unifiedLoginUrl();
      if (returnTo?.trim()) {
        url.searchParams.set('return_to', returnTo.trim());
      }
      if (refresh) {
        url.searchParams.set('refresh', 'true');
      }
      return relativeUrl(url);
    },
    async load(flowId, restartUrl) {
      const url = unifiedLoginUrl('/flows');
      url.searchParams.set('id', flowId);
      const response = await fetchFn(relativeUrl(url), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      return decodeBrowserFlowResponse(response, {
        asFlow: asKratosBrowserFlow,
        restartUrl: () => restartUrl,
      });
    },
    async submit(flowId, payload, restartUrl) {
      const response = await fetchFn(actionUrl(flowId), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      return decodeBrowserFlowResponse(response, {
        asFlow: asKratosBrowserFlow,
        restartUrl: () => restartUrl,
      });
    },
  };
}
