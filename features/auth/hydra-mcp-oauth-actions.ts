'use server';

import { notFound, redirect } from 'next/navigation';
import {
  acceptHydraConsent,
  assertMcpConsentRequest,
  getHydraConsentRequest,
  isMcpAuthor,
  parseHydraChallenge,
  rejectHydraConsent,
} from '@/features/auth/hydra-mcp-oauth';
import { getSessionFromCookie } from '@/lib/auth';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';

function consentContinuation(challenge: string): string {
  const query = new URLSearchParams({ consent_challenge: challenge });
  return `/oauth/authorize/consent?${query}`;
}

async function requireMcpSession(challenge: string) {
  const parsedChallenge = parseHydraChallenge(challenge);
  if (!parsedChallenge) {
    notFound();
  }
  const session = await getSessionFromCookie();
  if (!session) {
    redirect(buildLoginRedirectHref(consentContinuation(parsedChallenge)));
  }
  if (!isMcpAuthor(session)) {
    notFound();
  }
  return { challenge: parsedChallenge, session };
}

export async function approveMcpConsent(challenge: string): Promise<never> {
  const current = await requireMcpSession(challenge);
  const request = await getHydraConsentRequest(current.challenge);
  assertMcpConsentRequest(request, current.session);
  const continuation = await acceptHydraConsent(current.challenge, request, current.session);
  redirect(continuation);
}

export async function rejectMcpConsentAction(challenge: string): Promise<never> {
  const current = await requireMcpSession(challenge);
  const continuation = await rejectHydraConsent(current.challenge, current.session);
  redirect(continuation);
}
