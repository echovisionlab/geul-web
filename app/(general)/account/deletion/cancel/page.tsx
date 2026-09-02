import type { Metadata } from 'next';
import { IconAlertTriangle, IconCheck, IconX } from '@tabler/icons-react';
import { getTranslations } from 'next-intl/server';
import { Center, Paper, Stack, Text, Title } from '@mantine/core';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { cancelAccountDeletionAction } from '@/lib/actions/account';
import { buildAuthPageMetadata } from '@/lib/i18n/auth-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return buildAuthPageMetadata('cancelDeletion', '/account/deletion/cancel');
}

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function CancelDeletionPage({ searchParams }: Props) {
  const [t, tCommonActions, tCommonAuth] = await Promise.all([
    getTranslations('auth.cancelDeletion'),
    getTranslations('common.actions'),
    getTranslations('auth.common'),
  ]);
  const { token } = await searchParams;

  if (!token) {
    return (
      <Center style={{ flex: 1 }} p="md">
        <Paper p="xl" radius="md" withBorder w="100%" maw={450}>
          <Stack align="center" gap="md">
            <IconAlertTriangle size={48} color="var(--mantine-color-yellow-6)" />
            <Title order={3} ta="center">
              {tCommonAuth('cancelDeletionTitle')}
            </Title>
            <Text size="sm" c="dimmed" ta="center">
              {t('invalid.description')}
            </Text>
            <Button component="a" href="/" emphasis="medium">
              {tCommonActions('returnHome')}
            </Button>
          </Stack>
        </Paper>
      </Center>
    );
  }

  const result = await cancelAccountDeletionAction(token);

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
              <Button component="a" href="/login" emphasis="strong">
                {tCommonActions('logIn')}
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
              {tCommonActions('recoverAccount')}
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
