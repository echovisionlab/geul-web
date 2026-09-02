import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublicSettings } from '@/lib/queries/manifest';
import { getPublicCdnUrl } from '@/lib/public-runtime-config';
import { proxyFaviconRequest } from '@/lib/utils/favicon-proxy';
import { GET } from './route';

vi.mock('@/lib/queries/manifest', () => ({
  getPublicSettings: vi.fn(),
}));

vi.mock('@/lib/public-runtime-config', () => ({
  getPublicCdnUrl: vi.fn(() => 'https://cdn.example.com'),
}));

vi.mock('@/lib/utils/favicon-proxy', () => ({
  proxyFaviconRequest: vi.fn(async () => new Response(null, { status: 204 })),
}));

describe('favicon.ico route', () => {
  beforeEach(() => {
    vi.mocked(getPublicSettings).mockReset();
    vi.mocked(proxyFaviconRequest).mockClear();
  });

  it('proxies only the generated ICO URL', async () => {
    const icoUrl = 'https://cdn.example.com/asset/11111111-1111-4111-8111-111111111111/favicon.ico';
    vi.mocked(getPublicSettings).mockResolvedValue({
      favicon_url: 'https://cdn.example.com/asset/generated-32/favicon.png',
      favicon_asset_set: {
        icon_ico_url: icoUrl,
      },
    } as Awaited<ReturnType<typeof getPublicSettings>>);
    const request = new Request('https://studio.example.com/favicon.ico');

    await GET(request);

    expect(proxyFaviconRequest).toHaveBeenCalledWith({
      allowedCdnUrl: 'https://cdn.example.com',
      method: 'GET',
      requestHeaders: request.headers,
      sourceUrl: icoUrl,
    });
    expect(getPublicCdnUrl).toHaveBeenCalledTimes(1);
  });

  it('never proxies a legacy favicon that may contain PNG bytes', async () => {
    vi.mocked(getPublicSettings).mockResolvedValue({
      favicon_url: 'https://cdn.example.com/asset/legacy/favicon.png',
      favicon_asset_set: null,
    } as Awaited<ReturnType<typeof getPublicSettings>>);

    await GET(new Request('https://studio.example.com/favicon.ico'));

    expect(proxyFaviconRequest).toHaveBeenCalledWith(expect.objectContaining({ sourceUrl: null }));
  });
});
