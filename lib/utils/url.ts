/**
 * Join base URL with path, handling trailing/leading slashes
 */
export function joinUrl(base: string, path: string): string {
  const cleanBase = base.replace(/\/+$/, '');
  const cleanPath = path.replace(/^\/+/, '');
  return `${cleanBase}/${cleanPath}`;
}

/**
 * A visible address for a metadata value: no scheme or trailing slash, and only the host (plus an
 * ellipsis) once a deep path would outgrow the value column.
 */
export function formatDisplayUrl(url: string, maxLength = 40): string {
  const display = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (display.length <= maxLength) {
    return display;
  }
  try {
    const { hostname, pathname, search } = new URL(url);
    return pathname.length > 1 || search ? `${hostname}/…` : hostname;
  } catch {
    return display;
  }
}
