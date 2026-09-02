import { describe, expect, it } from 'vitest';
import type { AllSettings } from '@echovisionlab/geul-proto/secure/site_setting_pb.ts';
import { fromProtoAllSettings } from '@/lib/queries/site-setting-mapper';

describe('fromProtoAllSettings', () => {
  it('maps writable values and relation-backed asset projections only', () => {
    const result = fromProtoAllSettings({
      public: {
        siteTitle: 'Example Studio',
        primaryColor: '#123456',
        defaultCommentsEnabled: true,
        loaderAssets: [
          {
            fileId: 'loader-1',
            asset: { url: 'https://cdn.example.com/loader-1.gif' },
          },
        ],
        logoLightAsset: { url: 'https://cdn.example.com/logo-light.svg' },
      },
      runtime: { siteOrigin: 'https://example.com' },
      emailBatchSize: 100,
      emailRatePerSecond: 10,
      cacheSettings: { content: { days: 1 } },
      redisCacheSettings: { siteAsset: 300 },
      ogImageConfig: { home: {}, content: {} },
    } as unknown as AllSettings);

    expect(result.site_title).toBe('Example Studio');
    expect(result.site_origin).toBe('https://example.com');
    expect(result).not.toHaveProperty('site_url');
    expect(result.logo_light_url).toBe('https://cdn.example.com/logo-light.svg');
    expect(result.loader_urls).toEqual(['https://cdn.example.com/loader-1.gif']);
    expect(result.loader_assets).toEqual([{ file_id: 'loader-1', url: 'https://cdn.example.com/loader-1.gif' }]);
    expect(result).not.toHaveProperty('loader_url');
    expect(result).not.toHaveProperty('email_batch_size');
    expect(result).not.toHaveProperty('email_rate_per_second');
    expect(result).not.toHaveProperty('cache_settings');
    expect(result).not.toHaveProperty('redis_cache_settings');
    expect(result).not.toHaveProperty('site_og_asset_id');
  });
});
