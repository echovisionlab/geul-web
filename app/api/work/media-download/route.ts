import { connection, NextResponse } from 'next/server';
import { FileDownloadAction, FileDownloadAvailability } from '@echovisionlab/geul-proto/public/file_pb.ts';
import { findContentBlockMediaBySelector } from '@/lib/media/content-block-media-server';
import { getWorkView, getWorkViewWithShareToken } from '@/lib/queries/work';

export async function POST(request: Request) {
  await connection();
  const body = (await request.json().catch(() => null)) as {
    idOrSlug?: unknown;
    requestedLocale?: unknown;
    shareToken?: unknown;
    sharePassword?: unknown;
    selector?: { blockId?: unknown; referencePath?: unknown };
  } | null;
  const idOrSlug = typeof body?.idOrSlug === 'string' ? body.idOrSlug.trim() : '';
  const blockId = typeof body?.selector?.blockId === 'string' ? body.selector.blockId.trim() : '';
  const referencePath = typeof body?.selector?.referencePath === 'string' ? body.selector.referencePath.trim() : '';
  const requestedLocale = typeof body?.requestedLocale === 'string' ? body.requestedLocale : undefined;
  const shareToken = typeof body?.shareToken === 'string' ? body.shareToken.trim() : '';
  const sharePassword = typeof body?.sharePassword === 'string' ? body.sharePassword : undefined;
  if (!idOrSlug || !blockId || !referencePath) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const work = shareToken
    ? await getWorkViewWithShareToken(idOrSlug, shareToken, requestedLocale, sharePassword)
    : await getWorkView(idOrSlug, { requestedLocale });
  const item = work ? findContentBlockMediaBySelector(work.blockMedia, { blockId, referencePath }) : null;
  if (!item) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const availability = Number(item.downloadAvailability) as FileDownloadAvailability;
  const action = Number(item.downloadAction) as FileDownloadAction;
  const downloadUrl = item.delivery?.download?.url ?? '';
  return NextResponse.json(
    {
      access: { availability, action },
      ...(availability === FileDownloadAvailability.AVAILABLE && action === FileDownloadAction.DOWNLOAD && downloadUrl
        ? { download: { url: downloadUrl } }
        : {}),
    },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
  );
}
