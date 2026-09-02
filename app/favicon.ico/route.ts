import { getPublicSettings } from '@/lib/queries/manifest';
import { getPublicCdnUrl } from '@/lib/public-runtime-config';
import { proxyFaviconRequest } from '@/lib/utils/favicon-proxy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function forwardFavicon(request: Request, method: string): Promise<Response> {
  const settings = await getPublicSettings();
  const sourceUrl = settings.favicon_asset_set?.icon_ico_url ?? null;

  return proxyFaviconRequest({
    allowedCdnUrl: getPublicCdnUrl(),
    method,
    requestHeaders: request.headers,
    sourceUrl,
  });
}

export async function GET(request: Request): Promise<Response> {
  return forwardFavicon(request, 'GET');
}

export async function HEAD(request: Request): Promise<Response> {
  return forwardFavicon(request, 'HEAD');
}
