import { NextResponse, type NextRequest } from 'next/server';
import { acceptHydraLogin, parseHydraChallenge } from '@/features/auth/hydra-mcp-oauth';
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
  try {
    const continuation = await acceptHydraLogin(challenge, session);
    // The client is hidden from members it does not admit.
    return continuation ? NextResponse.redirect(continuation) : new NextResponse(null, { status: 404 });
  } catch (error) {
    logger.error('Failed to accept Hydra MCP login', { error, privateValues: [challenge] });
    return new NextResponse(null, { status: 502 });
  }
}
