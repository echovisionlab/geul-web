import type { Metadata } from 'next';
import { IconCheck, IconRefresh, IconX } from '@tabler/icons-react';
import { getTranslations } from 'next-intl/server';
import { Center, Paper, Stack, Text, Title } from '@mantine/core';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { confirmAccountRecoveryAction } from '@/lib/actions/account';
import { buildAuthPageMetadata } from '@/lib/i18n/auth-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return buildAuthPageMetadata('confirmRecovery', '/account/recovery/confirm');
}

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function ConfirmRecoveryPage({ searchParams }: Props) {
  const t = await getTranslations('auth.confirmRecovery');
  const tCommonActions = await getTranslations('common.actions');
  const { token } = await searchParams;

  if (!token) {
    return (
      <Center style={{ flex: 1 }} p="md">
        <Paper p="xl" radius="md" withBorder w="100%" maw={450}>
          <Stack align="center" gap="md">
            <IconRefresh size={48} color="var(--mantine-color-yellow-6)" />
            <Title order={3} ta="center">
              {t('invalid.title')}
            </Title>
            <Text size="sm" c="dimmed" ta="center">
              {t('invalid.description')}
            </Text>
            <Stack gap="sm" w="100%">
              <Button component="a" href="/account/recover" emphasis="medium">
                {t('actions.requestRecoveryLink')}
              </Button>
              <Button component="a" href="/" emphasis="low">
                {tCommonActions('returnHome')}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Center>
    );
  }

  const result = await confirmAccountRecoveryAction(token);

  if (result.success) {
    return (
      <Center style={{ flex: 1 }} p="md">
        <Paper p="xl" radius="md" withBorder w="100%" maw={450}>
          <Stack align="center" gap="md">
            <IconCheck size={48} color="var(--mantine-color-green-6)" />
            <Title order={3} ta="center">
              {t('success.title')}
            </Title>
            <Alert icon={<IconCheck size={16} />} tone="positive" w="100%">
              {result.message}
            </Alert>
            <Text size="sm" c="dimmed" ta="center">
              {t('success.description')}
            </Text>
            <Stack gap="sm" w="100%">
              <Button component="a" href="/login">
                {t('actions.goToLogin')}
              </Button>
              <Button component="a" href="/" emphasis="low">
                {tCommonActions('returnHome')}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Center>
    );
  }

  return (
    <Center style={{ flex: 1 }} p="md">
      <Paper p="xl" radius="md" withBorder w="100%" maw={450}>
        <Stack align="center" gap="md">
          <IconX size={48} color="var(--mantine-color-red-6)" />
          <Title order={3} ta="center">
            {t('failure.title')}
          </Title>
          <Alert icon={<IconX size={16} />} tone="danger" w="100%">
            {result.message}
          </Alert>
          <Text size="sm" c="dimmed" ta="center">
            {t('failure.description')}
          </Text>
          <Stack gap="sm" w="100%">
            <Button component="a" href="/account/recover" emphasis="medium">
              {t('actions.requestNewLink')}
            </Button>
            <Button component="a" href="/" emphasis="low">
              {tCommonActions('returnHome')}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Center>
  );
}
