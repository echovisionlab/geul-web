export type ExternalVideoProvider = 'youtube' | 'vimeo';
export type ExternalVideoAspectRatio = '16:9' | '4:3' | '1:1' | '9:16';

export interface ResolvedExternalVideo {
  provider: ExternalVideoProvider;
  videoId: string;
  embedUrl: string;
  aspectRatio: ExternalVideoAspectRatio;
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d+$/;
const VIMEO_HASH = /^[A-Za-z0-9]+$/;
const VIMEO_TIME = /^(?:\d+h)?(?:\d+m)?(?:\d+s)?$/i;

function parseSeconds(value: string | null): number | null {
  if (!value) {
    return null;
  }
  if (/^\d+$/.test(value)) {
    return Number(value);
  }
  const match = value.toLowerCase().match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!match || !match[0]) {
    return null;
  }
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

function safeUrl(rawUrl: string): URL | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export function resolveExternalVideo(rawUrl: string): ResolvedExternalVideo | null {
  const url = safeUrl(rawUrl.trim());
  if (!url) {
    return null;
  }
  const host = url.hostname.toLowerCase();

  let youtubeId = '';
  let shorts = false;
  if (host === 'youtu.be') {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length === 1) {
      youtubeId = parts[0];
    }
  } else if (host === 'www.youtube.com' || host === 'youtube.com') {
    if (url.pathname === '/watch') {
      youtubeId = url.searchParams.get('v') || '';
    } else {
      const match = url.pathname.match(/^\/(shorts|live|embed)\/([^/]+)\/?$/);
      youtubeId = match?.[2] || '';
      shorts = match?.[1] === 'shorts';
    }
  } else if (host === 'www.youtube-nocookie.com' || host === 'youtube-nocookie.com') {
    youtubeId = url.pathname.match(/^\/embed\/([^/]+)\/?$/)?.[1] || '';
  }
  if (youtubeId) {
    if (!YOUTUBE_ID.test(youtubeId)) {
      return null;
    }
    const start = parseSeconds(url.searchParams.get('start') || url.searchParams.get('t'));
    const query = new URLSearchParams({ autoplay: '0', playsinline: '1' });
    if (start && start > 0) {
      query.set('start', String(start));
    }
    return {
      provider: 'youtube',
      videoId: youtubeId,
      embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}?${query.toString()}`,
      aspectRatio: shorts ? '9:16' : '16:9',
    };
  }

  if (host === 'vimeo.com' || host === 'www.vimeo.com' || host === 'player.vimeo.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    let id = '';
    let hash = url.searchParams.get('h') || '';
    if (host === 'player.vimeo.com') {
      if (parts[0] === 'video' && parts.length === 2) {
        id = parts[1];
      }
    } else if (parts.length === 1) {
      id = parts[0];
    } else if (parts.length === 2 && VIMEO_ID.test(parts[0]) && VIMEO_HASH.test(parts[1])) {
      [id, hash] = parts;
    } else if (parts[0] === 'channels' && parts.length === 3) {
      id = parts[2];
    } else if (parts[0] === 'groups' && parts[2] === 'videos' && parts.length === 4) {
      id = parts[3];
    } else if (parts[0] === 'album' && parts[2] === 'video' && parts.length === 4) {
      id = parts[3];
    }
    if (!VIMEO_ID.test(id) || (hash && !VIMEO_HASH.test(hash))) {
      return null;
    }
    const query = new URLSearchParams();
    if (hash) {
      query.set('h', hash);
    }
    query.set('dnt', '1');
    query.set('autoplay', '0');
    const fragment = new URLSearchParams(url.hash.slice(1));
    const timeValues = fragment.getAll('t');
    const rawTime = timeValues.length === 1 ? timeValues[0] : '';
    const time = rawTime && VIMEO_TIME.test(rawTime) && /\d/.test(rawTime) ? rawTime : '';
    return {
      provider: 'vimeo',
      videoId: id,
      embedUrl: `https://player.vimeo.com/video/${id}?${query.toString()}${time ? `#t=${time}` : ''}`,
      aspectRatio: '16:9',
    };
  }
  return null;
}

export function isExternalVideoProviderUrl(rawUrl: string): boolean {
  let host = '';
  try {
    host = new URL(rawUrl.trim()).hostname.toLowerCase();
  } catch {
    return false;
  }
  return [
    'youtube.com',
    'www.youtube.com',
    'youtu.be',
    'youtube-nocookie.com',
    'www.youtube-nocookie.com',
    'vimeo.com',
    'www.vimeo.com',
    'player.vimeo.com',
  ].includes(host);
}
