'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Container, Stack, Text, Title } from '@mantine/core';
import { Button } from '@/components/core/Button';
import { reportClientRenderFailure } from '@/lib/observability/client-render-failure';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AdminError({ error, reset }: Props) {
  const t = useTranslations('generalError');
  const tCommonActions = useTranslations('common.actions');
  useEffect(() => {
    reportClientRenderFailure('admin', error);
  }, [error]);

  return (
    <Container size="sm" py="xl">
      <Stack align="center" gap="lg">
        <Title order={1}>{t('title')}</Title>
        <Text c="dimmed" ta="center">
          {t.rich('description', {
            br: () => <br />,
          })}
        </Text>
        <Stack gap="sm">
          <Button onClick={reset}>{tCommonActions('tryAgain')}</Button>
          <Button emphasis="low" component="a" href="/admin">
            {t('actions.goHome')}
          </Button>
        </Stack>
      </Stack>
    </Container>
  );
}
