import { z } from 'zod';
import type { SocialLinks } from './social-links-model';

// Compatibility facade: form/server validation callers retain their existing API.
export { PLATFORM_CONFIGS, SOCIAL_PLATFORMS } from './social-links-model';
export type { SocialLinks, SocialPlatform, SocialPlatformConfig } from './social-links-model';

// Common schema
export const socialLinksSchema = z.record(z.string(), z.string());

// Common parser
export function parseSocialLinks(value: unknown): SocialLinks {
  if (!value) {
    return {};
  }
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return socialLinksSchema.parse(parsed);
  } catch {
    return {};
  }
}
