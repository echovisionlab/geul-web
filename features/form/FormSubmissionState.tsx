'use client';

import { LayoutStack as DsLayoutStack, LayoutInset as DsLayoutInset } from '@/components/core/Layout';
import { Heading as DsHeading, Text as DsText } from '@/components/core/Typography';
import { IconCheck } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

import { PageLoader, type PageLoaderProps } from '@/features/site/PageLoader';
import { StatusIcon } from '@/components/core/Display';

interface FormSubmissionPendingStateProps {
  minHeight?: number;
  contrast?: PageLoaderProps['contrast'];
}

export function FormSubmissionPendingState({
  minHeight = 240,
  contrast = 'standard',
}: FormSubmissionPendingStateProps) {
  const tCommonStates = useTranslations('common.states');

  return (
    <div style={{ position: 'relative', minHeight }}>
      <DsLayoutInset space="none">
        <PageLoader message={tCommonStates('loading')} contrast={contrast} />
      </DsLayoutInset>
    </div>
  );
}

export function FormSubmissionSuccessState() {
  const tCommonMessages = useTranslations('common.messages');
  const tFormSuccess = useTranslations('formSuccessPage');

  return (
    <DsLayoutStack align="center" justify="center">
      <DsLayoutStack gap="lg" align="center" textAlign="center">
        <StatusIcon icon={IconCheck} tone="positive" size="lg" />
        <div>
          <DsHeading level={2} aria-level={1}>
            {tFormSuccess('title')}
          </DsHeading>
          <DsLayoutInset blockStart="xs">
            <DsText size="sm" tone="secondary">
              {tCommonMessages('formSubmittedSuccessfully')}
            </DsText>
          </DsLayoutInset>
        </div>
      </DsLayoutStack>
    </DsLayoutStack>
  );
}
