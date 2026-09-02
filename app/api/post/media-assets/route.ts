import { connection, NextResponse } from 'next/server';
import { getPostView, getPostViewWithToken } from '@/lib/queries/post';
import { activeContentBlockFileId, contentBlockMediaAssetRecord } from '@/lib/media/content-block-media-server';

export async function POST(request: Request) {
  await connection();
  const body = (await request.json().catch(() => null)) as {
    idOrSlug?: unknown;
    requestedLocale?: unknown;
    shareToken?: unknown;
    sharePassword?: unknown;
  } | null;
  const idOrSlug = typeof body?.idOrSlug === 'string' ? body.idOrSlug.trim() : '';
  const requestedLocale = typeof body?.requestedLocale === 'string' ? body.requestedLocale : undefined;
  const shareToken = typeof body?.shareToken === 'string' ? body.shareToken.trim() : '';
  const sharePassword = typeof body?.sharePassword === 'string' ? body.sharePassword : undefined;
  if (!idOrSlug) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const post = shareToken
    ? await getPostViewWithToken(idOrSlug, shareToken, requestedLocale, sharePassword)
    : await getPostView(idOrSlug, { requestedLocale });
  if (!post) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const media: Record<string, Record<string, string>> = {};
  for (const item of post.blockMedia) {
    const fileId = activeContentBlockFileId(item);
    if (fileId) {
      media[fileId] = contentBlockMediaAssetRecord(item);
    }
  }
  return NextResponse.json({ media }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}
