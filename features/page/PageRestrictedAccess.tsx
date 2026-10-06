import { getTranslations } from 'next-intl/server';
import { Center, Stack, Text, Title } from '@mantine/core';
import { Button } from '@/components/core/Button';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import type { PageDeniedReason } from '@/lib/queries/page';

export async function PageRestrictedAccess({ reason, returnTo }: { reason: PageDeniedReason; returnTo: string }) {
  const t = await getTranslations('pageEditor.access');
  const loginRequired = reason === 'authentication-required';
  return (
    <Center mih="60vh" p="md">
      <Stack align="center" gap="sm" maw={480}>
        <Title order={1} ta="center">
          {t(loginRequired ? 'loginRequiredTitle' : 'restrictedTitle')}
        </Title>
        <Text c="dimmed" ta="center">
          {t(loginRequired ? 'loginRequiredDescription' : 'restrictedDescription')}
        </Text>
        {loginRequired ? (
          <Button component="a" href={buildLoginRedirectHref(returnTo)}>
            {t('signIn')}
          </Button>
        ) : null}
      </Stack>
    </Center>
  );
}
