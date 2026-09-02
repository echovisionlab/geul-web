import type { Metadata } from 'next';
import { IconAlertTriangle, IconCheck, IconX } from '@tabler/icons-react';
import { getTimeZone, getTranslations } from 'next-intl/server';
import { Center, Paper, Stack, Text, Title } from '@mantine/core';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { confirmAccountDeletionAction } from '@/lib/actions/account';
import { buildAuthPageMetadata } from '@/lib/i18n/auth-metadata';
import { formatDateTimeInZone } from '@/components/core/DateTime';
import { getUserLocale } from '@/lib/utils/language.server';

export async function generateMetadata(): Promise<Metadata> {
  return buildAuthPageMetadata('confirmDeletion', '/account/deletion/confirm');
}

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function ConfirmDeletionPage({ searchParams }: Props) {
  const [t, tCommonActions, tCommonAuth, tCommonMessages, locale, timeZone] = await Promise.all([
    getTranslations('auth.confirmDeletion'),
    getTranslations('common.actions'),
    getTranslations('auth.common'),
    getTranslations('common.messages'),
    getUserLocale(),
    getTimeZone(),
  ]);
  const { token } = await searchParams;

  if (!token) {
    return (
      <Center style={{ flex: 1 }} p="md">
        <Paper p="xl" radius="md" withBorder w="100%" maw={450}>
          <Stack align="center" gap="md">
            <IconAlertTriangle size={48} color="var(--mantine-color-yellow-6)" />
            <Title order={3} ta="center">
              {tCommonAuth('confirmDeletionTitle')}
            </Title>
            <Text size="sm" c="dimmed" ta="center">
              {tCommonMessages('invalidConfirmationLinkFromEmail')}
            </Text>
            <Button component="a" href="/" emphasis="medium">
              {tCommonActions('returnHome')}
            </Button>
          </Stack>
        </Paper>
      </Center>
    );
  }

  const result = await confirmAccountDeletionAction(token);

  if (result.success) {
    return (
      <Center style={{ flex: 1 }} p="md">
        <Paper p="xl" radius="md" withBorder w="100%" maw={450}>
          <Stack align="center" gap="md">
            <IconAlertTriangle size={48} color="var(--mantine-color-orange-6)" />
            <Title order={3} ta="center">
              {t('success.title')}
            </Title>
            <Alert icon={<IconCheck size={16} />} tone="warning" w="100%">
              {result.message}
            </Alert>
            <Text size="sm" c="dimmed" ta="center">
              {t('success.description', {
                scheduledAt: result.scheduledAt
                  ? formatDateTimeInZone(result.scheduledAt, locale, timeZone, 'date', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : t('success.unknownDate'),
              })}
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
          <Button component="a" href="/" emphasis="medium">
            {tCommonActions('returnHome')}
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}
