import { connection, NextResponse } from 'next/server';
import { FileDownloadAction, FileDownloadAvailability } from '@echovisionlab/geul-proto/public/file_pb.ts';
import { getReleasePublic } from '@/lib/queries/release';

export async function POST(request: Request) {
  await connection();
  const body = (await request.json().catch(() => null)) as {
    idOrSlug?: unknown;
    trackId?: unknown;
    requestedLocale?: unknown;
    shareToken?: unknown;
    sharePassword?: unknown;
  } | null;
  const idOrSlug = typeof body?.idOrSlug === 'string' ? body.idOrSlug.trim() : '';
  const trackId = typeof body?.trackId === 'string' ? body.trackId.trim() : '';
  const requestedLocale = typeof body?.requestedLocale === 'string' ? body.requestedLocale : undefined;
  const shareToken = typeof body?.shareToken === 'string' ? body.shareToken.trim() : '';
  const sharePassword = typeof body?.sharePassword === 'string' ? body.sharePassword : undefined;
  if (!idOrSlug || !trackId) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const release = await getReleasePublic(idOrSlug, shareToken || undefined, {
    requestedLocale,
    sharePassword,
    hydrateWaveformData: false,
  });
  const track = release?.tracks.find((candidate) => candidate.id === trackId);
  if (!track) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json(
    {
      access: {
        availability: track.downloadAvailability,
        action: track.downloadAction,
      },
      ...(track.downloadAvailability === FileDownloadAvailability.AVAILABLE &&
      track.downloadAction === FileDownloadAction.DOWNLOAD &&
      track.downloadUrl
        ? { download: { url: track.downloadUrl } }
        : {}),
    },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
  );
}
