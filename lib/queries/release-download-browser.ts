import type { AuthorizeFileDownloadInput } from '@/lib/queries/file-download-browser';

export interface AuthorizeReleaseTrackDownloadInput extends AuthorizeFileDownloadInput {
  idOrSlug: string;
  trackId: string;
  requestedLocale: string;
  shareToken?: string;
  sharePassword?: string;
}

export async function authorizeReleaseTrackDownload(input: AuthorizeReleaseTrackDownloadInput) {
  const response = await fetch('/api/release/media-download', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error('Release track download authorization failed');
  }
  return response.json();
}
