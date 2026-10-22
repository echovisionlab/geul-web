import { McpConsentPageView } from '@/features/auth/McpConsentPageView';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { approveMcpConsent, rejectMcpConsentAction } from '@/features/auth/hydra-mcp-oauth-actions';
import {
  acceptHydraSignInConsent,
  assertMcpConsentRequest,
  getHydraConsentRequest,
  isMcpAuthor,
  isSignInClient,
  mcpClientDisplayName,
  mcpDelegationDisplayName,
  parseHydraChallenge,
} from '@/features/auth/hydra-mcp-oauth';
import { getSessionFromCookie } from '@/lib/auth';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: 'Remote MCP',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function consentContinuation(challenge: string): string {
  const query = new URLSearchParams({ consent_challenge: challenge });
  return `/oauth/authorize/consent?${query}`;
}

export default async function McpConsentPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const parameterNames = Object.keys(params);
  const challenge = parseHydraChallenge(params.consent_challenge);
  if (!challenge || parameterNames.some((name) => name !== 'consent_challenge')) {
    notFound();
  }

  const session = await getSessionFromCookie();
  if (!session) {
    redirect(buildLoginRedirectHref(consentContinuation(challenge)));
  }
  const request = await getHydraConsentRequest(challenge);
  if (isSignInClient(request.client.client_id)) {
    if (session.user.role !== 'admin') {
      notFound();
    }
    redirect(await acceptHydraSignInConsent(challenge, request, session));
  }
  if (!isMcpAuthor(session)) {
    notFound();
  }
  assertMcpConsentRequest(request, session);
  const clientName = mcpClientDisplayName(request);
  const delegationName = mcpDelegationDisplayName(request, session);
  const approve = approveMcpConsent.bind(null, challenge);
  const reject = rejectMcpConsentAction.bind(null, challenge);
  const [actions, labels, mcp] = await Promise.all([
    getTranslations('common.actions'),
    getTranslations('common.labels'),
    getTranslations('security.mcpIntegration'),
  ]);

  return (
    <McpConsentPageView
      clientName={clientName}
      delegationName={delegationName}
      offlineAccess={request.requested_scope.includes('offline_access')}
      description={mcp('consentDescription')}
      offlineDescription={mcp('consentOfflineAccess')}
      revokeDescription={mcp('consentRevoke', { settings: labels('settings') })}
      cancelLabel={actions('cancel')}
      connectLabel={actions('connect')}
      approveAction={approve}
      rejectAction={reject}
    />
  );
}
