import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';
import { USER_DISPLAY_COOKIE_NAME } from '@/lib/auth/user-display-cookie';
import { toSessionData } from '@/lib/session-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sessionData = await getSessionFromCookie();

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
