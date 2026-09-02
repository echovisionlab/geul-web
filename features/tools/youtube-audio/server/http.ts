import 'server-only';

import { NextResponse } from 'next/server';
import { YoutubeAudioError, type YoutubeAudioErrorCode } from '@echovisionlab/youtube-audio';
import { getSessionFromCookie } from '@/lib/auth';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('youtube-audio-api');
export const youtubeAudioNoStoreHeaders = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function getYoutubeAudioSubject(): Promise<string | null> {
  const session = await getSessionFromCookie();
  return session?.user.id ?? null;
}

export function youtubeAudioNotFoundResponse(): NextResponse {
  return NextResponse.json({ error: 'NOT_FOUND' }, { headers: youtubeAudioNoStoreHeaders, status: 404 });
}

export function toYoutubeAudioErrorResponse(error: unknown): NextResponse {
  if (error instanceof YoutubeAudioError) {
    if (error.code === 'UNAUTHORIZED') {
      return youtubeAudioNotFoundResponse();
    }
    return NextResponse.json(
      { error: error.code },
      { headers: youtubeAudioNoStoreHeaders, status: statusForCode(error.code) },
    );
  }
  logger.error('Unhandled YouTube audio request failure', { error });
  return NextResponse.json({ error: 'INTERNAL_ERROR' }, { headers: youtubeAudioNoStoreHeaders, status: 500 });
}

function statusForCode(code: YoutubeAudioErrorCode): number {
  switch (code) {
    case 'INVALID_REQUEST':
      return 400;
    case 'SOURCE_NOT_FOUND':
      return 404;
    case 'SOURCE_EXPIRED':
      return 410;
    case 'UNSUPPORTED_VIDEO':
      return 422;
    case 'REQUEST_ABORTED':
      return 408;
    case 'INVALID_UPSTREAM_RESPONSE':
    case 'UPSTREAM_FAILURE':
      return 502;
    case 'UNAUTHORIZED':
      return 404;
  }
}
