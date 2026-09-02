import {
  PLATFORM_CONFIGS,
  SOCIAL_PLATFORMS,
  type SocialLinks,
  type SocialPlatform,
} from '@/lib/types/common/social-links';

export interface SocialLinkDisplayEntry {
  key: string;
  platform: SocialPlatform;
  url: string;
}

/**
 * Check if platform is valid
 */
export function isValidPlatform(platform: string): platform is SocialPlatform {
  return SOCIAL_PLATFORMS.includes(platform as SocialPlatform);
}

function isOrderedSocialLinkKey(key: string): boolean {
  return /^(0|[1-9]\d*)$/.test(key);
}

function resolveSocialLinkPlatform(key: string, url: string): SocialPlatform | null {
  if (isValidPlatform(key)) {
    return key;
  }

  return inferSocialPlatformFromUrl(url);
}

export function inferSocialPlatformFromUrl(input: string): SocialPlatform | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  for (const platform of SOCIAL_PLATFORMS) {
    if (PLATFORM_CONFIGS[platform].urlPattern.test(trimmed)) {
      return platform;
    }
  }

  const hostname = getUrlHostname(trimmed);
  if (!hostname) {
    return null;
  }

  if (hostname === 'music.youtube.com') {
    return 'youtubemusic';
  }

  if (hostname === 'music.apple.com') {
    return 'applemusic';
  }

  if (hostname === 'open.spotify.com') {
    return 'spotify';
  }

  if (hostname.endsWith('.bandcamp.com')) {
    return 'bandcamp';
  }

  const hostPlatformEntries: [host: string, platform: SocialPlatform][] = [
    ['x.com', 'twitter'],
    ['twitter.com', 'twitter'],
    ['instagram.com', 'instagram'],
    ['facebook.com', 'facebook'],
    ['youtube.com', 'youtube'],
    ['youtu.be', 'youtube'],
    ['tiktok.com', 'tiktok'],
    ['threads.net', 'threads'],
    ['linkedin.com', 'linkedin'],
    ['github.com', 'github'],
    ['soundcloud.com', 'soundcloud'],
    ['beatport.com', 'beatport'],
    ['discogs.com', 'discogs'],
    ['tidal.com', 'tidal'],
    ['listen.tidal.com', 'tidal'],
    ['bsky.app', 'bluesky'],
    ['vimeo.com', 'vimeo'],
    ['twitch.tv', 'twitch'],
    ['kick.com', 'kick'],
    ['snapchat.com', 'snapchat'],
    ['pinterest.com', 'pinterest'],
    ['reddit.com', 'reddit'],
    ['discord.gg', 'discord'],
    ['discord.com', 'discord'],
    ['t.me', 'telegram'],
    ['wa.me', 'whatsapp'],
    ['whatsapp.com', 'whatsapp'],
    ['medium.com', 'medium'],
    ['substack.com', 'substack'],
    ['patreon.com', 'patreon'],
    ['behance.net', 'behance'],
    ['dribbble.com', 'dribbble'],
    ['flickr.com', 'flickr'],
    ['imdb.com', 'imdb'],
    ['letterboxd.com', 'letterboxd'],
    ['mixcloud.com', 'mixcloud'],
    ['deezer.com', 'deezer'],
    ['audiomack.com', 'audiomack'],
  ];

  return hostPlatformEntries.find(([host]) => hostname === host || hostname.endsWith(`.${host}`))?.[1] ?? null;
}

/**
 * Detect if input is a full URL
 */
function isFullUrl(input: string): boolean {
  return input.startsWith('http://') || input.startsWith('https://');
}

/**
 * Convert username to full URL
 */
function usernameToUrl(platform: SocialPlatform, username: string): string {
  const config = PLATFORM_CONFIGS[platform];
  const cleanUsername = username.replace(/^@/, '');

  // Bandcamp uses subdomain format
  if (platform === 'bandcamp') {
    return `https://${cleanUsername}.bandcamp.com`;
  }

  if (platform === 'substack') {
    const subdomain = cleanUsername.replace(/\.substack\.com$/, '');
    return `https://${subdomain}.substack.com`;
  }

  if (platform === 'mastodon' && cleanUsername.includes('@')) {
    const [user, host] = cleanUsername.split('@');
    if (user && host) {
      return `https://${host}/@${user}`;
    }
  }

  return `${config.baseUrl}${cleanUsername}`;
}

/**
 * Normalize input (username or URL) to full URL
 */
export function normalizeToUrl(platform: SocialPlatform, input: string): string {
  const trimmed = input.trim();

  if (!trimmed) {
    return '';
  }

  // If already a URL, return as-is (after basic normalization)
  if (isFullUrl(trimmed)) {
    return trimmed;
  }

  // Convert username to URL
  return usernameToUrl(platform, trimmed);
}

/**
 * Format social links object for saving (normalize all to URLs)
 */
export function formatForSave(links: { key: string; value: string }[]): SocialLinks {
  const result: SocialLinks = {};

  for (const link of links) {
    if (link.key && link.value && isValidPlatform(link.key)) {
      result[link.key] = normalizeToUrl(link.key, link.value);
    }
  }

  return result;
}

export function formatOrderedLinksForSave(links: { platform: string; value: string }[]): SocialLinks {
  const result: SocialLinks = {};

  links.forEach((link) => {
    if (!link.value || !isValidPlatform(link.platform)) {
      return;
    }

    result[Object.keys(result).length.toString()] = normalizeToUrl(link.platform, link.value);
  });

  return result;
}

export function toEditableOrderedArray(links: SocialLinks): { key: string; platform: string; value: string }[] {
  return getStoredSocialLinkEntries(links).map(({ key, platform, url }) => ({
    key,
    platform: platform ?? '',
    value: url,
  }));
}

/**
 * Drop unsupported platforms and empty URLs while preserving the saved order.
 */
export function getDisplaySocialLinkEntries(links: SocialLinks): SocialLinkDisplayEntry[] {
  return getStoredSocialLinkEntries(links)
    .filter((entry): entry is StoredSocialLinkEntry & { platform: SocialPlatform } => {
      return entry.platform !== null;
    })
    .map(({ key, platform, url }) => ({ key, platform, url }));
}

/**
 * Convert platform-specific optional URL fields into the shared social-links map.
 */
export function compactSocialLinks(links: Partial<Record<SocialPlatform, string | null | undefined>>): SocialLinks {
  const result: SocialLinks = {};

  for (const platform of SOCIAL_PLATFORMS) {
    const url = links[platform]?.trim();
    if (url) {
      result[platform] = url;
    }
  }

  return result;
}

interface StoredSocialLinkEntry {
  key: string;
  platform: SocialPlatform | null;
  url: string;
}

function getStoredSocialLinkEntries(links: SocialLinks): StoredSocialLinkEntry[] {
  return Object.entries(links)
    .filter(([, url]) => url.trim().length > 0)
    .sort(([a], [b]) => {
      const aIsOrdered = isOrderedSocialLinkKey(a);
      const bIsOrdered = isOrderedSocialLinkKey(b);
      if (aIsOrdered && bIsOrdered) {
        return Number(a) - Number(b);
      }
      if (aIsOrdered) {
        return -1;
      }
      if (bIsOrdered) {
        return 1;
      }
      return 0;
    })
    .map(([key, url]) => ({
      key,
      platform: resolveSocialLinkPlatform(key, url),
      url,
    }));
}

function getUrlHostname(input: string): string | null {
  try {
    return new URL(input).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}
