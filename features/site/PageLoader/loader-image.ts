import { toCdnUrl } from '@/lib/utils/file-url';

export function resolvePageLoaderImage(urls: readonly string[]) {
  // Use the same configured image for server markup, hydration and navigation.
  // Changing the source after hydration requests another asset and flashes.
  const selected = urls.find((url) => url.trim().length > 0);
  const src = selected ? toCdnUrl(selected) : null;
  let pathname = '';
  if (src) {
    try {
      pathname = new URL(src, 'http://internal').pathname.toLowerCase();
    } catch {
      pathname = src.split(/[?#]/, 1)[0].toLowerCase();
    }
  }
  return { src, unoptimized: pathname.endsWith('.gif') || pathname.endsWith('.svg') };
}
