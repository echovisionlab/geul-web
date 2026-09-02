import {
  buildManagedImageUrl,
  MANAGED_IMAGE_DEFAULT_QUALITY,
  resolveManagedImageBucketWidth,
} from './utils/managed-image-url';

/**
 * Custom image loader for Next.js Image component.
 * Transforms width/quality props into our API's query parameters.
 *
 * Usage: Next.js automatically uses this loader when configured in next.config.mjs
 * <Image src="/asset/..." width={400} /> → cdn.example.invalid/asset/...?w=480&q=80
 */
export default function imageLoader({ src, width, quality }: { src: string; width: number; quality?: number }): string {
  const managedImageUrl = buildManagedImageUrl(src, {
    width: resolveManagedImageBucketWidth(width),
    quality: quality ?? MANAGED_IMAGE_DEFAULT_QUALITY,
  });
  if (managedImageUrl !== src) {
    return managedImageUrl ?? src;
  }

  // Skip external URLs - pass through unchanged
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }

  // Legacy or other paths - keep as relative
  const sep = src.includes('?') ? '&' : '?';
  return `${src}${sep}w=${width}`;
}
