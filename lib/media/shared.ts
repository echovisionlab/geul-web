import { normalizeHydrationUrl } from '@echovisionlab/geul-common/media/hydration';

export type MediaTextAlignment = 'left' | 'center' | 'right';

export interface MediaContainerStyleRecord {
  width?: string;
  marginLeft?: string;
  marginRight?: string;
}

export { normalizeHydrationUrl } from '@echovisionlab/geul-common/media/hydration';

export function normalizeMediaTextAlignment(value: string | undefined | null): MediaTextAlignment {
  return value === 'center' || value === 'right' ? value : 'left';
}

export function resolveMediaDisplayName(input: { name?: string; fallback: string }): string {
  const normalizedName = normalizeHydrationUrl(input.name);
  if (normalizedName) {
    return normalizedName;
  }
  return input.fallback;
}

const MEDIA_NAME_ATTRIBUTE = 'data-media-name';

const MIME_DOWNLOAD_EXTENSIONS: Record<string, string> = {
  'application/epub+zip': 'epub',
  'application/gzip': 'gz',
  'application/json': 'json',
  'application/msword': 'doc',
  'application/pdf': 'pdf',
  'application/rtf': 'rtf',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/x-7z-compressed': '7z',
  'application/x-rar-compressed': 'rar',
  'application/zip': 'zip',
  'text/csv': 'csv',
  'text/html': 'html',
  'text/markdown': 'md',
  'text/plain': 'txt',
};

const KNOWN_DOWNLOAD_EXTENSIONS = new Set([
  ...Object.values(MIME_DOWNLOAD_EXTENSIONS),
  'aif',
  'aiff',
  'aac',
  'avi',
  'caf',
  'flac',
  'heic',
  'heif',
  'jpeg',
  'jpg',
  'm4a',
  'mkv',
  'mov',
  'mp3',
  'mp4',
  'ogg',
  'png',
  'svg',
  'webm',
  'webp',
  'wav',
]);

function readKnownDownloadExtension(value: string): string {
  const match = value.match(/\.([a-z0-9]{1,10})$/i);
  const extension = match?.[1]?.toLowerCase() || '';
  return KNOWN_DOWNLOAD_EXTENSIONS.has(extension) ? extension : '';
}

function readUrlDownloadExtension(url: string): string {
  try {
    const parsed = new URL(url);
    const lastSegment = parsed.pathname.split('/').pop() || '';
    return readKnownDownloadExtension(lastSegment);
  } catch {
    return '';
  }
}

export function resolveMediaDownloadName(input: {
  name?: string | null;
  mimeType?: string | null;
  url?: string | null;
  fallback?: string;
}): string {
  const baseName = normalizeHydrationUrl(input.name) || input.fallback || 'download';
  if (readKnownDownloadExtension(baseName)) {
    return baseName;
  }

  const mimeType = normalizeHydrationUrl(input.mimeType).toLowerCase().split(';', 1)[0] || '';
  const extension =
    readUrlDownloadExtension(normalizeHydrationUrl(input.url)) || MIME_DOWNLOAD_EXTENSIONS[mimeType] || '';

  return extension ? `${baseName}.${extension}` : baseName;
}

export function readCanonicalMediaName(element: Element, legacyTitleSelector: string): string {
  if (element.hasAttribute(MEDIA_NAME_ATTRIBUTE)) {
    return element.getAttribute(MEDIA_NAME_ATTRIBUTE) || '';
  }

  return element.querySelector(legacyTitleSelector)?.textContent || '';
}

export function formatMediaSize(value: string | number | undefined | null): string {
  const sizeNum = typeof value === 'number' ? value : parseInt(typeof value === 'string' ? value : '0', 10) || 0;

  if (sizeNum <= 0) {
    return '';
  }
  if (sizeNum >= 1048576) {
    return `${(sizeNum / 1048576).toFixed(1)} MB`;
  }
  if (sizeNum >= 1024) {
    return `${(sizeNum / 1024).toFixed(1)} KB`;
  }
  return `${sizeNum} B`;
}

export function resolveMediaContainerStyle(
  previewWidth: string | number | undefined | null,
  textAlignment: string | undefined | null,
): MediaContainerStyleRecord {
  const widthPercent =
    typeof previewWidth === 'number'
      ? previewWidth
      : Math.max(10, Math.min(100, parseInt((previewWidth || '100').toString(), 10) || 100));

  if (widthPercent >= 100) {
    return {};
  }

  const style: MediaContainerStyleRecord = {
    width: `${widthPercent}%`,
  };
  const alignment = normalizeMediaTextAlignment(textAlignment);

  if (alignment === 'center') {
    style.marginLeft = 'auto';
    style.marginRight = 'auto';
  } else if (alignment === 'right') {
    style.marginLeft = 'auto';
    style.marginRight = '0';
  } else {
    style.marginLeft = '0';
    style.marginRight = 'auto';
  }

  return style;
}

export function mediaContainerStyleToReact(style: MediaContainerStyleRecord): React.CSSProperties | undefined {
  if (Object.keys(style).length === 0) {
    return undefined;
  }
  return style;
}

export function mediaStyleToString(style: MediaContainerStyleRecord): string {
  return Object.entries(style)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${value}`)
    .join(';');
}

export function getBlockPropString(props: Record<string, unknown>, key: string, fallback = ''): string {
  const value = props[key];
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return fallback;
}

export function looksLikeHlsUrl(url: string): boolean {
  const normalized = normalizeHydrationUrl(url);
  return normalized.endsWith('.m3u8') || normalized.includes('.m3u8?');
}

export function resolveSeekTimeFromClientX(element: HTMLElement, clientX: number, duration: number): number | null {
  if (!(duration > 0)) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  if (!rect.width) {
    return null;
  }

  const progress = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  return progress * duration;
}

export function clampMediaTime(time: number, duration: number): number {
  const safeTime = Number.isFinite(time) ? time : 0;
  if (!(duration > 0)) {
    return Math.max(0, safeTime);
  }
  return Math.max(0, Math.min(duration, safeTime));
}

export function resolvePlaybackProgress(currentTime: number, duration: number): number {
  if (!(duration > 0)) {
    return 0;
  }
  return Math.max(0, Math.min(1, currentTime / duration));
}
