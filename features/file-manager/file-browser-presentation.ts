/** Shared type column presentation for the file manager and library picker. */
export function fileBrowserTypeLabel(
  item: { kind: 'folder' | 'file'; mimeType?: string },
  folderLabel: string,
): string {
  return (item.kind === 'folder' ? folderLabel : (item.mimeType ?? '')).toLowerCase();
}

/** Compact rows use the file's format; full MIME values remain available in details. */
export function fileBrowserFormatLabel(
  item: { kind: 'folder' | 'file'; extension?: string; mimeType?: string },
  folderLabel: string,
): string {
  if (item.kind === 'folder') {
    return folderLabel.toLowerCase();
  }
  const extension = item.extension?.trim().replace(/^\.+/, '').toLowerCase();
  if (extension) {
    return extension;
  }
  const subtype = item.mimeType?.split('/')[1]?.split(/[;+]/)[0]?.replace(/^x-/, '').toLowerCase() ?? '';
  const aliases: Record<string, string> = { jpeg: 'jpg', plain: 'txt', 'octet-stream': 'file' };
  return aliases[subtype] ?? subtype;
}

/** Resolve domain values once through the same adapter in both list consumers. */
export function fileBrowserListPresentation(
  item: { kind: 'folder' | 'file'; extension?: string; mimeType?: string; fileSize?: number },
  name: string,
  folderLabel: string,
  location?: string,
) {
  return {
    name,
    format: fileBrowserFormatLabel(item, folderLabel),
    size: item.kind === 'file' ? fileBrowserSizeLabel(item.fileSize ?? 0) : undefined,
    location,
  };
}

/** One concise capacity formatter for browser rows and details. */
export function fileBrowserSizeLabel(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
