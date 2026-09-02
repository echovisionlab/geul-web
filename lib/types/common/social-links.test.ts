import type { SimpleIcon } from 'simple-icons';
import { describe, expect, it } from 'vitest';
import { SOCIAL_ICON_DEFINITIONS, SOCIAL_ICON_PLATFORMS } from '@/components/core/Social/platforms';
import { PLATFORM_CONFIGS, SOCIAL_PLATFORMS, type SocialPlatformConfig } from './social-links';

describe('social platform compatibility metadata', () => {
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
