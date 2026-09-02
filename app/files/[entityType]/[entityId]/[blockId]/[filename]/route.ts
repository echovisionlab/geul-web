import { connection, NextResponse } from 'next/server';
import {
  ContentBlockDownloadAction,
  ContentBlockDownloadAvailability,
  type ContentBlockMediaItem,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { findContentBlockMediaBySelector } from '@/lib/media/content-block-media-server';
import { getPageView } from '@/lib/queries/page';
import { getPostView } from '@/lib/queries/post';
import { getProgramEventView } from '@/lib/queries/program-event';
import { getWorkView } from '@/lib/queries/work';

interface RouteParams {
  params: Promise<{
    entityType: string;
    entityId: string;
    blockId: string;
    filename: string;
  }>;
}

const privateNoStoreHeaders = { 'Cache-Control': 'private, no-store, max-age=0' };

async function loadBlockMedia(entityType: string, entityId: string): Promise<readonly ContentBlockMediaItem[]> {
  switch (entityType) {
    case 'post':
      return (await getPostView(entityId))?.blockMedia ?? [];
    case 'page':
      return (await getPageView(entityId))?.blockMedia ?? [];
    case 'work':
      return (await getWorkView(entityId))?.blockMedia ?? [];
    case 'program_event':
      return (await getProgramEventView(entityId))?.blockMedia ?? [];
    default:
      return [];
  }
}

export async function GET(_request: Request, { params }: RouteParams) {
  await connection();
  const { entityType, entityId, blockId } = await params;
  if (!entityId.trim() || !blockId.trim()) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: privateNoStoreHeaders });
  }

  const blockMedia = await loadBlockMedia(entityType, entityId).catch(() => []);
  const item = findContentBlockMediaBySelector(blockMedia, { blockId, referencePath: 'file' });
  if (!item) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: privateNoStoreHeaders });
  }

  const availability = item.downloadAvailability;
  const action = item.downloadAction;
  const downloadUrl = item.delivery?.download?.url.trim() ?? '';
  if (
    availability !== ContentBlockDownloadAvailability.AVAILABLE ||
    action !== ContentBlockDownloadAction.DOWNLOAD ||
    !downloadUrl
  ) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: privateNoStoreHeaders });
  }

  const response = NextResponse.redirect(downloadUrl, 307);
  response.headers.set('Cache-Control', privateNoStoreHeaders['Cache-Control']);
  return response;
}
