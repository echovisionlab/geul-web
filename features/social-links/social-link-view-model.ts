import type { SocialPlatform } from '@/components/core/Social';
import { PLATFORM_CONFIGS, SOCIAL_PLATFORMS } from '@/lib/types/common/social-links';
import { isValidPlatform } from '@/lib/utils/social-links';
import type { SocialPlatformOption } from './ui/SocialLinkInputView';

export const SOCIAL_PLATFORM_OPTIONS: SocialPlatformOption[] = SOCIAL_PLATFORMS.map((platform) => ({
  value: platform,
  label: PLATFORM_CONFIGS[platform].label,
}));

export function getSocialLinkInputViewModel(platform: string): {
  selectedPlatform: SocialPlatform | null;
  selectedValuePlaceholder: string | null;
} {
  if (!isValidPlatform(platform)) {
    return { selectedPlatform: null, selectedValuePlaceholder: null };
  }

  return {
    selectedPlatform: platform,
    selectedValuePlaceholder: PLATFORM_CONFIGS[platform].placeholder,
  };
}
