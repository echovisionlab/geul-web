import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublicSettings } from '@/lib/queries/manifest';
import manifest from './manifest';

vi.mock('@/lib/queries/manifest', () => ({
  getPublicSettings: vi.fn(),
}));

describe('web app manifest route', () => {
  beforeEach(() => {
    vi.mocked(getPublicSettings).mockReset();
  });

  it('reads current public settings for every dynamic manifest request', async () => {
    vi.mocked(getPublicSettings).mockResolvedValue({
      site_title: 'Example Studio',
      primary_color: '#123456',
      favicon_asset_set: {
        icon_ico_url: 'https://cdn.example.com/asset/favicon/favicon.ico',
        icon_png_16_url: 'https://cdn.example.com/asset/16/favicon.png',
        icon_png_32_url: 'https://cdn.example.com/asset/32/favicon.png',
        icon_png_48_url: 'https://cdn.example.com/asset/48/favicon.png',
        apple_touch_icon_180_url: 'https://cdn.example.com/asset/180/favicon.png',
        manifest_icon_192_url: 'https://cdn.example.com/asset/192/favicon.png',
        manifest_icon_512_url: 'https://cdn.example.com/asset/512/favicon.png',
        icon_svg_url: null,
      },
    } as Awaited<ReturnType<typeof getPublicSettings>>);

    const result = await manifest();

    expect(getPublicSettings).toHaveBeenCalledTimes(1);
    expect(result.icons).toEqual([
      {
        src: 'https://cdn.example.com/asset/192/favicon.png',
        type: 'image/png',
        sizes: '192x192',
        purpose: 'any',
      },
      {
        src: 'https://cdn.example.com/asset/512/favicon.png',
        type: 'image/png',
        sizes: '512x512',
        purpose: 'any',
      },
    ]);
  });
});
