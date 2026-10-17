import { describe, expect, it } from 'vitest';
import type { AllSettings } from '@echovisionlab/geul-proto/secure/site_setting_pb.ts';
import { fromProtoAllSettings } from '@/lib/queries/site-setting-mapper';

describe('fromProtoAllSettings', () => {
  it('maps writable values and relation-backed asset projections only', () => {
    const result = fromProtoAllSettings({
      public: {
        siteTitle: 'Example Studio',
        contactEmail: 'contact@example.com',
        legalEmail: 'legal@example.com',
        primaryColor: '#123456',
        defaultCommentsEnabled: true,
        loaderAssets: [
          {
            fileId: 'loader-1',
            asset: { url: 'https://cdn.example.com/loader-1.gif' },
          },
        ],
        logoFullLightAsset: { url: 'https://cdn.example.com/logo-light.svg' },
        logoEmailDarkAsset: { url: 'https://cdn.example.com/email-dark.png' },
      },
      runtime: { siteOrigin: 'https://example.com' },
      emailBatchSize: 100,
      emailRatePerSecond: 10,
      cacheSettings: { content: { days: 1 } },
      redisCacheSettings: { siteAsset: 300 },
      ogImageConfig: { home: {}, content: {} },
    } as unknown as AllSettings);

    expect(result.site_title).toBe('Example Studio');
    expect(result.contact_email).toBe('contact@example.com');
    expect(result.legal_email).toBe('legal@example.com');
    expect(result.site_origin).toBe('https://example.com');
    expect(result).not.toHaveProperty('site_url');
    expect(result.logo_full_light_url).toBe('https://cdn.example.com/logo-light.svg');
    expect(result.logo_email_dark_url).toBe('https://cdn.example.com/email-dark.png');
    // Stored slots stay raw: no fallback from the full logo to an unset slot.
    expect(result.logo_full_dark_url).toBeNull();
    expect(result.logo_symbol_light_url).toBeNull();
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
