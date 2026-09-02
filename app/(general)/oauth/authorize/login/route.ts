import { NextResponse, type NextRequest } from 'next/server';
import { acceptHydraLogin, isMcpAuthor, parseHydraChallenge } from '@/features/auth/hydra-mcp-oauth';
import { getSessionFromCookie } from '@/lib/auth';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import { getSiteOrigin } from '@/lib/env';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('mcp-oauth-login');

function loginContinuation(challenge: string): string {
  const query = new URLSearchParams({ login_challenge: challenge });
  return `/oauth/authorize/login?${query}`;
}

export async function GET(request: NextRequest) {
  const parameterNames = Array.from(request.nextUrl.searchParams.keys());
  const challenges = request.nextUrl.searchParams.getAll('login_challenge');
  const challenge = parseHydraChallenge(challenges.length === 1 ? challenges[0] : null);
  if (!challenge || parameterNames.some((name) => name !== 'login_challenge')) {
    return new NextResponse(null, { status: 400 });
  }

  const session = await getSessionFromCookie();
  if (!session) {
    return NextResponse.redirect(new URL(buildLoginRedirectHref(loginContinuation(challenge)), getSiteOrigin()));
  }
  if (!isMcpAuthor(session)) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    return NextResponse.redirect(await acceptHydraLogin(challenge, session));
  } catch (error) {
    logger.error('Failed to accept Hydra MCP login', { error });
    return new NextResponse(null, { status: 502 });
  }
}
