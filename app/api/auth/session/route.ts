import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';
import { USER_DISPLAY_COOKIE_NAME } from '@/lib/auth/user-display-cookie';
import { toSessionData } from '@/lib/session-data';
import { toHttpErrorResult } from '@/lib/api/http-error';

export const dynamic = 'force-dynamic';

export async function GET() {
  let sessionData;
  try {
    sessionData = await getSessionFromCookie({ throwOnError: true });
  } catch (err) {
    const { status, error } = toHttpErrorResult(err, 'Failed to fetch session');
    return NextResponse.json({ error }, { status });
  }

  if (!sessionData) {
    const response = NextResponse.json(null, { status: 401 });
    response.cookies.set(USER_DISPLAY_COOKIE_NAME, '', {
      path: '/',
      maxAge: 0,
      sameSite: 'lax',
    });
    return response;
  }

  return NextResponse.json(toSessionData(sessionData));
}
