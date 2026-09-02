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
  const subject = await getYoutubeAudioSubject();
  if (subject === null) {
    return youtubeAudioNotFoundResponse();
  }

  try {
    const { sourceId } = await params;
    const sourceStore = createSingleYoutubeAudioSourceStore(
      decryptYoutubeAudioSourceRecord(readYoutubeAudioSourceCookie(request, sourceId), env.ENCRYPTION_SECRET),
    );
    return await getYoutubeAudioService(await getBaseUrl(), sourceStore).read({
      range: request.headers.get('range') ?? '',
      signal: request.signal,
      sourceId,
      subject,
    });
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
