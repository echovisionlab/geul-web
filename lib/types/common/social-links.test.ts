import type { SimpleIcon } from 'simple-icons';
import { describe, expect, it } from 'vitest';
import { SOCIAL_ICON_DEFINITIONS, SOCIAL_ICON_PLATFORMS } from '@/components/core/Social/platforms';
import {
  parseSocialLinks,
  PLATFORM_CONFIGS,
  SOCIAL_PLATFORMS,
  socialLinksSchema,
  type SocialPlatformConfig,
} from './social-links';
import {
  PLATFORM_CONFIGS as DISPLAY_PLATFORM_CONFIGS,
  SOCIAL_PLATFORMS as DISPLAY_SOCIAL_PLATFORMS,
} from './social-links-model';

describe('social platform compatibility metadata', () => {
  it('reexports the same metadata objects for validation and display consumers', () => {
    expect(PLATFORM_CONFIGS).toBe(DISPLAY_PLATFORM_CONFIGS);
    expect(SOCIAL_PLATFORMS).toBe(DISPLAY_SOCIAL_PLATFORMS);
  });

  it('preserves the public config icon contract for every platform', () => {
    expect(SOCIAL_PLATFORMS).toBe(SOCIAL_ICON_PLATFORMS);
    expect(Object.keys(PLATFORM_CONFIGS)).toEqual([...SOCIAL_PLATFORMS]);

    for (const platform of SOCIAL_PLATFORMS) {
      const config: SocialPlatformConfig = PLATFORM_CONFIGS[platform];
      const icon: SimpleIcon = config.icon;

      expect(config.id).toBe(platform);
      expect(icon.path).toBeTruthy();
      expect(icon.hex).toMatch(/^[0-9A-F]{6}$/i);
    }
  });

  it('derives labels and icon objects from the Core metadata source', () => {
    for (const platform of SOCIAL_PLATFORMS) {
      expect(PLATFORM_CONFIGS[platform].label).toBe(SOCIAL_ICON_DEFINITIONS[platform].label);
      expect(PLATFORM_CONFIGS[platform].icon).toBe(SOCIAL_ICON_DEFINITIONS[platform].icon);
    }
  });
});

describe('social link validation compatibility', () => {
  it('parses legacy platform keys and ordered keys without changing stored values', () => {
    const links = {
      instagram: 'https://instagram.com/example',
      '0': 'https://github.com/example',
      custom: ' unchanged ',
    };
    expect(parseSocialLinks(links)).toEqual(links);
    expect(parseSocialLinks(JSON.stringify(links))).toEqual(links);
    expect(socialLinksSchema.parse(links)).toEqual(links);
  });

  it.each([undefined, null, false, 0, '', 'not json', 'null', '[]', '42', [], { instagram: 123 }, { nested: {} }])(
    'retains empty-object fallback for invalid input %j',
    (value) => {
      expect(parseSocialLinks(value)).toEqual({});
    },
  );
});
