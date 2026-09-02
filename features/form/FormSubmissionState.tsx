'use client';

import { IconCheck } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Box, Center, Stack, Text, Title } from '@mantine/core';
import { PageLoader } from '@/features/site/PageLoader';

interface FormSubmissionPendingStateProps {
  minHeight?: number;
}

export function FormSubmissionPendingState({ minHeight = 240 }: FormSubmissionPendingStateProps) {
  const tCommonStates = useTranslations('common.states');

  return (
    <Box style={{ position: 'relative', minHeight }}>
      <PageLoader message={tCommonStates('loading')} />
    </Box>
  );
}

export function FormSubmissionSuccessState() {
  const tCommonMessages = useTranslations('common.messages');
  const tFormSuccess = useTranslations('formSuccessPage');

  return (
    <Center>
      <Stack gap="lg" align="center" ta="center">
        <IconCheck size={48} color="var(--mantine-color-green-6)" />
        <div>
          <Title order={2}>{tFormSuccess('title')}</Title>
          <Text c="dimmed" mt="xs">
            {tCommonMessages('formSubmittedSuccessfully')}
          </Text>
        </div>
      </Stack>
    </Center>
  );
}
