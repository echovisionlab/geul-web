import { NextResponse } from 'next/server';
import {
  getYoutubeAudioSubject,
  toYoutubeAudioErrorResponse,
  youtubeAudioNoStoreHeaders,
  youtubeAudioNotFoundResponse,
} from '@/features/tools/youtube-audio/server/http';
import { getYoutubeAudioService } from '@/features/tools/youtube-audio/server/service';
import {
  createSingleYoutubeAudioSourceStore,
  decryptYoutubeAudioSourceRecord,
  readYoutubeAudioSourceCookie,
  youtubeAudioSourceCookieName,
  youtubeAudioSourceCookiePath,
} from '@/features/tools/youtube-audio/server/source-cookie';
import { env } from '@/lib/env';
import { getBaseUrl } from '@/lib/utils/url.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ sourceId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  return readSource(request, await params, false);
}

export async function HEAD(request: Request, { params }: RouteParams) {
  return readSource(request, await params, true);
}

async function readSource(request: Request, { sourceId }: { sourceId: string }, head: boolean) {
  const subject = await getYoutubeAudioSubject();
  if (subject === null) {
    return youtubeAudioNotFoundResponse();
  }

  try {
    const record = decryptYoutubeAudioSourceRecord(
      readYoutubeAudioSourceCookie(request, sourceId),
      env.ENCRYPTION_SECRET,
    );
    const sourceStore = createSingleYoutubeAudioSourceStore(record);
    const download = new URL(request.url).searchParams.get('download') === '1';
    const browserRange = request.headers.get('range');
    const downloadRange =
      record && download
        ? (browserRange ?? 'bytes=0-').replace(/^(bytes=\d+)-$/, `$1-${record.upstream.size - 1}`)
        : (browserRange ?? '');
    const response = await getYoutubeAudioService(await getBaseUrl(), sourceStore).read({
      range: head ? 'bytes=0-0' : downloadRange,
      signal: request.signal,
      sourceId,
      subject,
    });
    if (head) {
      // Preflight checks ownership, expiry and upstream availability without reading the file.
      await response.body?.cancel();
      return new Response(null, { headers: youtubeAudioNoStoreHeaders });
    }
    if (!download || !record) {
      return response;
    }
    const headers = new Headers(response.headers);
    const fileName = record.upstream.fileName.toWellFormed().replace(/[\r\n]/g, '');
    const encodedName = encodeURIComponent(fileName).replace(
      /['()*]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    );
    headers.set('Content-Disposition', `attachment; filename="audio"; filename*=UTF-8''${encodedName}`);
    headers.set('X-Content-Type-Options', 'nosniff');
    if (browserRange === null) {
      headers.delete('Content-Range');
    }
    // Hand the upstream stream directly to the browser; never buffer it as a Blob or ArrayBuffer.
    return new Response(response.body, { headers, status: browserRange === null ? 200 : 206 });
  } catch (error) {
    return toYoutubeAudioErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const subject = await getYoutubeAudioSubject();
  if (subject === null) {
    return youtubeAudioNotFoundResponse();
  }

  try {
    const { sourceId } = await params;
    const baseUrl = await getBaseUrl();
    const sourceStore = createSingleYoutubeAudioSourceStore(
      decryptYoutubeAudioSourceRecord(readYoutubeAudioSourceCookie(request, sourceId), env.ENCRYPTION_SECRET),
    );
    await getYoutubeAudioService(baseUrl, sourceStore).revoke({ sourceId, subject });
    const response = new NextResponse(null, { headers: youtubeAudioNoStoreHeaders, status: 204 });
    response.cookies.set(youtubeAudioSourceCookieName(sourceId), '', {
      expires: new Date(0),
      httpOnly: true,
      maxAge: 0,
      path: youtubeAudioSourceCookiePath(sourceId),
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production' || new URL(baseUrl).protocol === 'https:',
    });
    return response;
  } catch (error) {
    return toYoutubeAudioErrorResponse(error);
  }
}
