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
  encryptYoutubeAudioSourceRecord,
  youtubeAudioSourceCookieName,
  youtubeAudioSourceCookiePath,
} from '@/features/tools/youtube-audio/server/source-cookie';
import { env } from '@/lib/env';
import { getBaseUrl } from '@/lib/utils/url.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const subject = await getYoutubeAudioSubject();
  if (subject === null) {
    return youtubeAudioNotFoundResponse();
  }

  try {
    const baseUrl = await getBaseUrl();
    const body = (await request.json()) as { url?: unknown };
    const url = typeof body?.url === 'string' ? body.url : '';
    const sourceStore = createSingleYoutubeAudioSourceStore();
    const resolved = await getYoutubeAudioService(baseUrl, sourceStore).resolve({
      signal: request.signal,
      subject,
      url,
    });
    const record = sourceStore.current();
    if (record === null) {
      throw new Error('YouTube audio resolution did not produce a source ticket.');
    }
    const response = NextResponse.json(resolved, { headers: youtubeAudioNoStoreHeaders });
    response.cookies.set(
      youtubeAudioSourceCookieName(record.id),
      encryptYoutubeAudioSourceRecord(record, env.ENCRYPTION_SECRET),
      {
        expires: new Date(record.expiresAt),
        httpOnly: true,
        path: youtubeAudioSourceCookiePath(record.id),
        sameSite: 'lax',
        secure: env.NODE_ENV === 'production' || new URL(baseUrl).protocol === 'https:',
      },
    );
    return response;
  } catch (error) {
    return toYoutubeAudioErrorResponse(error);
  }
}
