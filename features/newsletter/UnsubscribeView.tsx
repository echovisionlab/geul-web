'use client';

import Link from 'next/link';
import { IconCheck, IconX } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Container, Stack, Text } from '@mantine/core';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';

export type UnsubscribeViewStatus = 'success' | 'error' | 'missing-token';

export function UnsubscribeView({ status }: { status: UnsubscribeViewStatus }) {
  const t = useTranslations('unsubscribe');
  const tCommonActions = useTranslations('common.actions');
  const success = status === 'success';

  return (
    <Container
      size="sm"
      py="xl"
      w="100%"
      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      data-unsubscribe-state={status}
    >
      <Stack align="center" gap="md" w="100%" maw={400}>
        <Alert
          icon={success ? <IconCheck size={16} /> : <IconX size={16} />}
          tone={success ? 'positive' : 'danger'}
          w="100%"
        >
          {t(success ? 'token.success.title' : 'token.error.title')}
        </Alert>
        <Text size="sm" c="dimmed" ta="center">
          {t(success ? 'token.success.description' : 'token.error.description')}
        </Text>
        <Button component={Link} href="/" emphasis="medium">
          {tCommonActions('returnHome')}
        </Button>
      </Stack>
    </Container>
  );
}
