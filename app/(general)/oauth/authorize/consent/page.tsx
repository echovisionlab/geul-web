import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Center, Container, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { IconPlugConnected } from '@tabler/icons-react';
import { Button } from '@/components/core/Button';
import { approveMcpConsent, rejectMcpConsentAction } from '@/features/auth/hydra-mcp-oauth-actions';
import {
  assertMcpConsentRequest,
  getHydraConsentRequest,
  isMcpAuthor,
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
  if (!isMcpAuthor(session)) {
    notFound();
  }

  const request = await getHydraConsentRequest(challenge);
  assertMcpConsentRequest(request, session);
  const clientName = mcpClientDisplayName(request);
  const delegationName = mcpDelegationDisplayName(request, session);
  const approve = approveMcpConsent.bind(null, challenge);
  const reject = rejectMcpConsentAction.bind(null, challenge);
  const [actions, mcp] = await Promise.all([
    getTranslations('common.actions'),
    getTranslations('security.mcpIntegration'),
  ]);

  return (
    <Container size="xs" py="xl">
      <Center mih="70vh">
        <Paper withBorder p="xl" radius="md" w="100%">
          <Stack gap="lg">
            <IconPlugConnected size={36} aria-hidden />
            <Stack gap="xs">
              <Title order={1}>Remote MCP</Title>
              <Text fw={600}>{clientName}</Text>
              <Text c="dimmed">{mcp('description')}</Text>
              <Text size="sm" c="dimmed">
                {delegationName}
              </Text>
            </Stack>
            <Group justify="flex-end">
              <form action={reject}>
                <Button type="submit" tone="neutral" emphasis="medium">
                  {actions('cancel')}
                </Button>
              </form>
              <form action={approve}>
                <Button type="submit">{actions('connect')}</Button>
              </form>
            </Group>
          </Stack>
        </Paper>
      </Center>
    </Container>
  );
}
