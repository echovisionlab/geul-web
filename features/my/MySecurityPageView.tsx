'use client';
import type { ComponentProps } from 'react';
import { useTranslations } from 'next-intl';
import { LayoutStack } from '@/components/core/Layout';
import { Heading, Text } from '@/components/core/Typography';
import { Alert } from '@/components/core/Alert';
import { SecurityForm } from './SecurityForm';
export function MySecurityPageView({ error, ...props }: ComponentProps<typeof SecurityForm> & { error?: string }) {
  const t = useTranslations('common.labels');
  return (
    <LayoutStack>
      <Heading level={1} scale={2}>
        {t('security')}
      </Heading>
      {error ? (
        <Alert tone="danger">
          <Text size="sm">{error}</Text>
        </Alert>
      ) : (
        <SecurityForm {...props} />
      )}
    </LayoutStack>
  );
}
