export interface VideoJsSourceInput {
  hlsSrc?: string;
  src?: string;
  poster?: string;
  onError?: () => boolean | void;
  onBeforeError?: (error?: VideoJsRuntimeError) => boolean | void;
}

export interface VideoJsRuntimeError {
  code?: unknown;
  message?: unknown;
}

export interface VideoJsMessages {
  locale: string;
  regionLabel: string;
  play: string;
  pause: string;
  strings: Record<string, string>;
}

export function normalizeMediaUrl(url: string | undefined): string {
  const trimmed = (url || '').trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') {
    return '';
  }
  return trimmed;
}

function isValidMediaUrl(url: string): boolean {
  if (!url) {
    return false;
  }
  if (url.startsWith('/') || url.startsWith('blob:') || url.startsWith('data:')) {
    return true;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function resolveSourceType(src: string): string | undefined {
  if (src.endsWith('.m3u8') || src.includes('.m3u8?')) {
    return 'application/x-mpegURL';
  }
  if (src.endsWith('.mp4') || src.includes('.mp4?')) {
    return 'video/mp4';
  }
  if (src.endsWith('.webm') || src.includes('.webm?')) {
    return 'video/webm';
  }
  if (src.endsWith('.mov') || src.includes('.mov?')) {
    return 'video/quicktime';
  }
  return undefined;
}

export function resolveVideoPlaybackSource(input: VideoJsSourceInput) {
  const hlsSrc = normalizeMediaUrl(input.hlsSrc);
  if (isValidMediaUrl(hlsSrc)) {
    return {
      src: hlsSrc,
      type: 'application/x-mpegURL',
    };
  }

  const src = normalizeMediaUrl(input.src);
  if (isValidMediaUrl(src)) {
    return {
      src,
      type: resolveSourceType(src),
    };
  }

  return null;
}
