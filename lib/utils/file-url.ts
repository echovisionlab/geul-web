/**
 * Utility functions for computing file URLs from file IDs
 */

import { getPublicCdnUrl } from '@/lib/public-runtime-config';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

/**
 * /asset/... 또는 /media/... 상대 경로를 CDN URL로 변환
 * 이미 절대 URL이면 그대로 반환
 * @example "/asset/uuid/image.webp" → "https://cdn.example.com/asset/uuid/image.webp"
 */
export function toCdnUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  if (path.startsWith('/asset/') || path.startsWith('/media/')) {
    return `${getPublicCdnUrl()}${path}`;
  }
  return path;
}

export function isManagedCdnAssetUrl(path: string): boolean {
  if (!path) {
    return false;
  }

  if (path.startsWith('/asset/')) {
    return true;
  }

  if (!path.startsWith('http://') && !path.startsWith('https://')) {
    return false;
  }

  try {
    const candidate = new URL(path);
    const cdn = new URL(trimTrailingSlash(getPublicCdnUrl()));
    return candidate.origin === cdn.origin && candidate.pathname.startsWith('/asset/');
  } catch {
    return false;
  }
}
