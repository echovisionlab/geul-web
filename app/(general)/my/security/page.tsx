import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Stack, Text, Title } from '@mantine/core';
import { Alert } from '@/components/core/Alert';
import { buildLoginBrowserUrl } from '@/features/auth/login-redirect';
import {
  ACCOUNT_SECURITY_CONTINUATION_PARAM,
  PASSKEY_SECURITY_CONTINUATION_PARAM,
  isSecuritySessionFresh,
} from '@/features/auth/security-reauthentication';
import { SecurityForm } from '@/features/my/SecurityForm';
import { getMySecurityAction } from '@/lib/actions/identity';
import { getMemberId } from '@/lib/utils/session.server';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return null;
}

function securityPageReturnTo(searchParams: Record<string, string | string[] | undefined>): string {
  const returnParams = new URLSearchParams();
  const flowId = firstParam(searchParams.flow);
  const linkProvider = firstParam(searchParams.link_provider);
  const unlinkProvider = firstParam(searchParams.unlink_provider);
  if (flowId) {
    returnParams.set('flow', flowId);
  }
  if (linkProvider === 'google' || linkProvider === 'github') {
    returnParams.set('link_provider', linkProvider);
  }
  if (unlinkProvider === 'google' || unlinkProvider === 'github') {
    returnParams.set('unlink_provider', unlinkProvider);
  }
  if (firstParam(searchParams[ACCOUNT_SECURITY_CONTINUATION_PARAM]) === '1') {
    returnParams.set(ACCOUNT_SECURITY_CONTINUATION_PARAM, '1');
  }
  if (firstParam(searchParams[PASSKEY_SECURITY_CONTINUATION_PARAM]) === '1') {
    returnParams.set(PASSKEY_SECURITY_CONTINUATION_PARAM, '1');
  }
  const query = returnParams.toString();
  return query ? `/my/security?${query}` : '/my/security';
}

export default async function MySecurityPage({ searchParams }: PageProps) {
  await connection();

  const tCommonLabels = await getTranslations('common.labels');
  const tSecurityNotifications = await getTranslations('security.notifications');
  const memberId = await getMemberId();
  if (!memberId) {
    redirect('/login');
  }

  const sp = await searchParams;
  const initialFlowId = firstParam(sp.flow);
  const initialLinkProviderParam = firstParam(sp.link_provider);
  const initialUnlinkProviderParam = firstParam(sp.unlink_provider);

  const security = await getMySecurityAction();

  if (security.error) {
    return (
      <Stack>
        <Title order={2}>{tCommonLabels('security')}</Title>
        <Alert tone="danger">
          <Text size="sm">{tSecurityNotifications('failedToLoad')}</Text>
        </Alert>
      </Stack>
    );
  }

  if (!isSecuritySessionFresh(security.sessions)) {
    redirect(buildLoginBrowserUrl({ refresh: true, returnTo: securityPageReturnTo(sp) }));
  }

  return (
    <Stack>
      <Title order={2}>{tCommonLabels('security')}</Title>
      <SecurityForm
        subjectId={memberId}
        initialSessions={security.sessions}
        initialProviders={security.providers}
        initialCanonicalEmail={security.canonicalEmail}
        initialEmailCodeAvailable={security.emailCodeAvailable}
        initialPasskeyCount={security.passkeyCount}
        initialFlowId={initialFlowId}
        initialLinkProviderParam={initialLinkProviderParam}
        initialUnlinkProviderParam={initialUnlinkProviderParam}
      />
    </Stack>
  );
}
