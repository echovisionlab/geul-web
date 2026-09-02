'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { IconCheck, IconMail, IconRefresh } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Center, Paper, Stack, Text, Title } from '@mantine/core';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { TextInput } from '@/components/core/Input';
import { RecoveryFormState, requestAccountRecoveryFormAction } from '@/lib/actions/account';

const initialState: RecoveryFormState = {
  success: false,
  message: '',
  submitted: false,
};

export function RecoverAccountContent() {
  const t = useTranslations('auth.recoverAccount');
  const tAuthCommon = useTranslations('auth.common');
  const tCommonActions = useTranslations('common.actions');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const [state, formAction, isPending] = useActionState(requestAccountRecoveryFormAction, initialState);

  if (state.submitted) {
    return (
      <Center style={{ flex: 1 }} p="md">
        <Paper p="xl" radius="md" withBorder w="100%" maw={450}>
          <Stack align="center" gap="md">
            <IconMail size={48} color="var(--mantine-color-blue-6)" />
            <Title order={3} ta="center">
              {tAuthCommon('checkYourEmailTitle')}
            </Title>
            <Alert icon={<IconCheck size={16} />} tone="accent" w="100%">
              {t('submitted.alert')}
            </Alert>
            <Text size="sm" c="dimmed" ta="center">
              {t('submitted.description')}
            </Text>
            <Stack gap="sm" w="100%">
              <Button
                emphasis="medium"
                leftSection={<IconRefresh size={16} />}
                component={Link}
                href="/account/recover"
              >
                {t('submitted.tryAnotherEmail')}
              </Button>
              <Button component={Link} href="/" tone="neutral" emphasis="low">
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
        <form action={formAction}>
          <Stack gap="md">
            <IconRefresh size={48} color="var(--mantine-color-blue-6)" style={{ alignSelf: 'center' }} />
            <Title order={3} ta="center">
              {t('form.title')}
            </Title>
            <Text size="sm" c="dimmed" ta="center">
              {t('form.description')}
            </Text>

            <TextInput
              name="email"
              label={t('form.emailLabel')}
              placeholder={tCommonPlaceholders('emailExample')}
              type="email"
              required
              disabled={isPending}
              error={!state.success && state.message ? state.message : undefined}
            />

            <Button type="submit" loading={isPending} fullWidth>
              {t('form.submit')}
            </Button>

            <Button component={Link} href="/login" tone="neutral" emphasis="low" fullWidth>
              {tCommonActions('backToLogin')}
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
