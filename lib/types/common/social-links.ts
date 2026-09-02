import type { SimpleIcon } from 'simple-icons';
import { z } from 'zod';
import {
  SOCIAL_ICON_DEFINITIONS,
  SOCIAL_ICON_PLATFORMS,
  type SocialPlatform,
} from '@/components/core/Social/platforms';

export const SOCIAL_PLATFORMS = SOCIAL_ICON_PLATFORMS;
export type { SocialPlatform };

// Common type
export interface SocialLinks {
  [key: string]: string;
}

// Platform configuration type
export interface SocialPlatformConfig {
  id: SocialPlatform;
  label: string;
  icon: SimpleIcon;
  placeholder: string;
  baseUrl: string;
  usernamePattern: RegExp;
  urlPattern: RegExp;
}

type SocialPlatformBehaviorConfig = Omit<SocialPlatformConfig, 'icon' | 'id' | 'label'>;

function definePlatformConfig(id: SocialPlatform, behavior: SocialPlatformBehaviorConfig): SocialPlatformConfig {
  const { label, icon } = SOCIAL_ICON_DEFINITIONS[id];
  return { id, label, icon, ...behavior };
}

// Platform-specific settings
export const PLATFORM_CONFIGS: Record<SocialPlatform, SocialPlatformConfig> = {
  twitter: definePlatformConfig('twitter', {
    placeholder: 'https://x.com/username',
    baseUrl: 'https://x.com/',
    usernamePattern: /^@?([a-zA-Z0-9_]{1,15})$/,
    urlPattern: /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/?$/,
  }),
  instagram: definePlatformConfig('instagram', {
    placeholder: 'https://instagram.com/username',
    baseUrl: 'https://instagram.com/',
    usernamePattern: /^@?([a-zA-Z0-9_.]{1,30})$/,
    urlPattern: /^https?:\/\/(www\.)?instagram\.com\/([a-zA-Z0-9_.]+)\/?$/,
  }),
  facebook: definePlatformConfig('facebook', {
    placeholder: 'https://facebook.com/username',
    baseUrl: 'https://facebook.com/',
    usernamePattern: /^@?([a-zA-Z0-9.]{5,50})$/,
    urlPattern: /^https?:\/\/(www\.)?facebook\.com\/([a-zA-Z0-9.]+)\/?$/,
  }),
  youtube: definePlatformConfig('youtube', {
    placeholder: 'https://youtube.com/@channel',
    baseUrl: 'https://youtube.com/@',
    usernamePattern: /^@?([a-zA-Z0-9_-]{1,50})$/,
    urlPattern: /^https?:\/\/(www\.)?(youtube\.com\/(c\/|channel\/|@)?|youtu\.be\/)([a-zA-Z0-9_-]+)\/?$/,
  }),
  tiktok: definePlatformConfig('tiktok', {
    placeholder: 'https://tiktok.com/@username',
    baseUrl: 'https://tiktok.com/@',
    usernamePattern: /^@?([a-zA-Z0-9_.]{2,24})$/,
    urlPattern: /^https?:\/\/(www\.)?tiktok\.com\/@([a-zA-Z0-9_.]+)\/?$/,
  }),
  threads: definePlatformConfig('threads', {
    placeholder: 'https://threads.net/@username',
    baseUrl: 'https://threads.net/@',
    usernamePattern: /^@?([a-zA-Z0-9_.]{1,30})$/,
    urlPattern: /^https?:\/\/(www\.)?threads\.net\/@([a-zA-Z0-9_.]+)\/?$/,
  }),
  bluesky: definePlatformConfig('bluesky', {
    placeholder: 'https://bsky.app/profile/username.bsky.social',
    baseUrl: 'https://bsky.app/profile/',
    usernamePattern: /^@?([a-zA-Z0-9.-]+)$/,
    urlPattern: /^https?:\/\/bsky\.app\/profile\/([a-zA-Z0-9.-]+)\/?$/,
  }),
  mastodon: definePlatformConfig('mastodon', {
    placeholder: 'https://mastodon.social/@username',
    baseUrl: 'https://mastodon.social/@',
    usernamePattern: /^@?([a-zA-Z0-9_]+)(@[a-zA-Z0-9.-]+)?$/,
    urlPattern: /^https?:\/\/([a-zA-Z0-9.-]+)\/@([a-zA-Z0-9_]+)\/?$/,
  }),
  vimeo: definePlatformConfig('vimeo', {
    placeholder: 'https://vimeo.com/username',
    baseUrl: 'https://vimeo.com/',
    usernamePattern: /^([a-zA-Z0-9_-]+)$/,
    urlPattern: /^https?:\/\/(www\.)?vimeo\.com\/([a-zA-Z0-9_-]+)\/?$/,
  }),
  twitch: definePlatformConfig('twitch', {
    placeholder: 'https://twitch.tv/username',
    baseUrl: 'https://twitch.tv/',
    usernamePattern: /^([a-zA-Z0-9_]{3,25})$/,
    urlPattern: /^https?:\/\/(www\.)?twitch\.tv\/([a-zA-Z0-9_]+)\/?$/,
  }),
  kick: definePlatformConfig('kick', {
    placeholder: 'https://kick.com/username',
    baseUrl: 'https://kick.com/',
    usernamePattern: /^([a-zA-Z0-9_]{3,25})$/,
    urlPattern: /^https?:\/\/(www\.)?kick\.com\/([a-zA-Z0-9_]+)\/?$/,
  }),
  snapchat: definePlatformConfig('snapchat', {
    placeholder: 'https://snapchat.com/add/username',
    baseUrl: 'https://snapchat.com/add/',
    usernamePattern: /^([a-zA-Z0-9_.-]{3,30})$/,
    urlPattern: /^https?:\/\/(www\.)?snapchat\.com\/add\/([a-zA-Z0-9_.-]+)\/?$/,
  }),
  pinterest: definePlatformConfig('pinterest', {
    placeholder: 'https://pinterest.com/username',
    baseUrl: 'https://pinterest.com/',
    usernamePattern: /^([a-zA-Z0-9_]{3,30})$/,
    urlPattern: /^https?:\/\/(www\.)?pinterest\.com\/([a-zA-Z0-9_]+)\/?$/,
  }),
  reddit: definePlatformConfig('reddit', {
    placeholder: 'https://reddit.com/user/username',
    baseUrl: 'https://reddit.com/user/',
    usernamePattern: /^([a-zA-Z0-9_-]{3,20})$/,
    urlPattern: /^https?:\/\/(www\.)?reddit\.com\/(user|u)\/([a-zA-Z0-9_-]+)\/?$/,
  }),
  discord: definePlatformConfig('discord', {
    placeholder: 'https://discord.gg/invite',
    baseUrl: 'https://discord.gg/',
    usernamePattern: /^([a-zA-Z0-9_-]+)$/,
    urlPattern: /^https?:\/\/(www\.)?(discord\.gg|discord\.com\/invite)\/([a-zA-Z0-9_-]+)\/?$/,
  }),
  telegram: definePlatformConfig('telegram', {
    placeholder: 'https://t.me/username',
    baseUrl: 'https://t.me/',
    usernamePattern: /^@?([a-zA-Z0-9_]{5,32})$/,
    urlPattern: /^https?:\/\/t\.me\/([a-zA-Z0-9_]+)\/?$/,
  }),
  whatsapp: definePlatformConfig('whatsapp', {
    placeholder: 'https://wa.me/15551234567',
    baseUrl: 'https://wa.me/',
    usernamePattern: /^(\+?[0-9]{6,20})$/,
    urlPattern: /^https?:\/\/(wa\.me|api\.whatsapp\.com\/send)\/?([^/?]+)?(\?.*)?$/,
  }),
  linkedin: definePlatformConfig('linkedin', {
    placeholder: 'https://linkedin.com/in/username',
    baseUrl: 'https://linkedin.com/in/',
    usernamePattern: /^([a-zA-Z0-9-]{3,100})$/,
    urlPattern: /^https?:\/\/(www\.)?linkedin\.com\/(in|company)\/([a-zA-Z0-9-]+)\/?$/,
  }),
  github: definePlatformConfig('github', {
    placeholder: 'https://github.com/username',
    baseUrl: 'https://github.com/',
    usernamePattern: /^@?([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?)$/,
    urlPattern: /^https?:\/\/(www\.)?github\.com\/([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?)\/?$/,
  }),
  medium: definePlatformConfig('medium', {
    placeholder: 'https://medium.com/@username',
    baseUrl: 'https://medium.com/@',
    usernamePattern: /^@?([a-zA-Z0-9_-]+)$/,
    urlPattern: /^https?:\/\/(www\.)?medium\.com\/@?([a-zA-Z0-9_-]+)\/?$/,
  }),
  substack: definePlatformConfig('substack', {
    placeholder: 'https://username.substack.com',
    baseUrl: 'https://',
    usernamePattern: /^([a-zA-Z0-9-]+)(\.substack\.com)?$/,
    urlPattern: /^https?:\/\/([a-zA-Z0-9-]+)\.substack\.com\/?$/,
  }),
  patreon: definePlatformConfig('patreon', {
    placeholder: 'https://patreon.com/username',
    baseUrl: 'https://patreon.com/',
    usernamePattern: /^([a-zA-Z0-9_-]+)$/,
    urlPattern: /^https?:\/\/(www\.)?patreon\.com\/([a-zA-Z0-9_-]+)\/?$/,
  }),
  behance: definePlatformConfig('behance', {
    placeholder: 'https://behance.net/username',
    baseUrl: 'https://behance.net/',
    usernamePattern: /^([a-zA-Z0-9_-]+)$/,
    urlPattern: /^https?:\/\/(www\.)?behance\.net\/([a-zA-Z0-9_-]+)\/?$/,
  }),
  dribbble: definePlatformConfig('dribbble', {
    placeholder: 'https://dribbble.com/username',
    baseUrl: 'https://dribbble.com/',
    usernamePattern: /^([a-zA-Z0-9_-]+)$/,
    urlPattern: /^https?:\/\/(www\.)?dribbble\.com\/([a-zA-Z0-9_-]+)\/?$/,
  }),
  flickr: definePlatformConfig('flickr', {
    placeholder: 'https://flickr.com/people/username',
    baseUrl: 'https://flickr.com/people/',
    usernamePattern: /^([a-zA-Z0-9@._-]+)$/,
    urlPattern: /^https?:\/\/(www\.)?flickr\.com\/(people|photos)\/([a-zA-Z0-9@._-]+)\/?$/,
  }),
  imdb: definePlatformConfig('imdb', {
    placeholder: 'https://imdb.com/name/nm0000000',
    baseUrl: 'https://imdb.com/name/',
    usernamePattern: /^(nm[0-9]+)$/,
    urlPattern: /^https?:\/\/(www\.)?imdb\.com\/name\/(nm[0-9]+)\/?$/,
  }),
  letterboxd: definePlatformConfig('letterboxd', {
    placeholder: 'https://letterboxd.com/username',
    baseUrl: 'https://letterboxd.com/',
    usernamePattern: /^([a-zA-Z0-9_-]+)$/,
    urlPattern: /^https?:\/\/(www\.)?letterboxd\.com\/([a-zA-Z0-9_-]+)\/?$/,
  }),
  spotify: definePlatformConfig('spotify', {
    placeholder: 'https://open.spotify.com/artist/ID',
    baseUrl: 'https://open.spotify.com/artist/',
    usernamePattern: /^([a-zA-Z0-9]{22})$/,
    urlPattern: /^https?:\/\/open\.spotify\.com\/artist\/([a-zA-Z0-9]+)(\?.*)?$/,
  }),
  applemusic: definePlatformConfig('applemusic', {
    placeholder: 'https://music.apple.com/artist/name/ID',
    baseUrl: 'https://music.apple.com/artist/',
    usernamePattern: /^([a-zA-Z0-9-]+\/[0-9]+)$/,
    urlPattern: /^https?:\/\/music\.apple\.com\/[a-z]{2}\/artist\/([a-zA-Z0-9-]+\/[0-9]+)(\?.*)?$/,
  }),
  soundcloud: definePlatformConfig('soundcloud', {
    placeholder: 'https://soundcloud.com/username',
    baseUrl: 'https://soundcloud.com/',
    usernamePattern: /^([a-zA-Z0-9_-]{3,25})$/,
    urlPattern: /^https?:\/\/(www\.)?soundcloud\.com\/([a-zA-Z0-9_-]+)\/?$/,
  }),
  bandcamp: definePlatformConfig('bandcamp', {
    placeholder: 'https://artist.bandcamp.com',
    baseUrl: '.bandcamp.com',
    usernamePattern: /^([a-zA-Z0-9-]+)$/,
    urlPattern: /^https?:\/\/([a-zA-Z0-9-]+)\.bandcamp\.com\/?$/,
  }),
  mixcloud: definePlatformConfig('mixcloud', {
    placeholder: 'https://mixcloud.com/username',
    baseUrl: 'https://mixcloud.com/',
    usernamePattern: /^([a-zA-Z0-9_-]+)$/,
    urlPattern: /^https?:\/\/(www\.)?mixcloud\.com\/([a-zA-Z0-9_-]+)\/?$/,
  }),
  deezer: definePlatformConfig('deezer', {
    placeholder: 'https://deezer.com/artist/ID',
    baseUrl: 'https://deezer.com/artist/',
    usernamePattern: /^([0-9]+)$/,
    urlPattern: /^https?:\/\/(www\.)?deezer\.com\/([a-z]{2}\/)?artist\/([0-9]+)(\?.*)?$/,
  }),
  audiomack: definePlatformConfig('audiomack', {
    placeholder: 'https://audiomack.com/username',
    baseUrl: 'https://audiomack.com/',
    usernamePattern: /^([a-zA-Z0-9_-]+)$/,
    urlPattern: /^https?:\/\/(www\.)?audiomack\.com\/([a-zA-Z0-9_-]+)\/?$/,
  }),
  beatport: definePlatformConfig('beatport', {
    placeholder: 'https://beatport.com/artist/name/ID',
    baseUrl: 'https://beatport.com/artist/',
    usernamePattern: /^([a-zA-Z0-9-]+\/[0-9]+)$/,
    urlPattern: /^https?:\/\/(www\.)?beatport\.com\/artist\/([a-zA-Z0-9-]+\/[0-9]+)(\?.*)?$/,
  }),
  discogs: definePlatformConfig('discogs', {
    placeholder: 'https://discogs.com/artist/ID',
    baseUrl: 'https://discogs.com/artist/',
    usernamePattern: /^([0-9]+)$/,
    urlPattern: /^https?:\/\/(www\.)?discogs\.com\/artist\/([0-9]+)(\?.*)?$/,
  }),
  tidal: definePlatformConfig('tidal', {
    placeholder: 'https://tidal.com/artist/ID',
    baseUrl: 'https://tidal.com/artist/',
    usernamePattern: /^([0-9]+)$/,
    urlPattern: /^https?:\/\/(www\.)?(tidal\.com|listen\.tidal\.com)\/artist\/([0-9]+)(\?.*)?$/,
  }),
  youtubemusic: definePlatformConfig('youtubemusic', {
    placeholder: 'https://music.youtube.com/channel/ID',
    baseUrl: 'https://music.youtube.com/channel/',
    usernamePattern: /^(UC[a-zA-Z0-9_-]{22})$/,
    urlPattern: /^https?:\/\/music\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})(\?.*)?$/,
  }),
};

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
