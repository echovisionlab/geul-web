'use client';
import { LayoutContainer, LayoutInset, LayoutStack } from '@/components/core/Layout';
import { SectionCard } from '@/components/core/Section';
import { SiteLogo } from '@/features/site/SiteLogo';
import { FormSubmissionSuccessState } from './FormSubmissionState';
/** Complete success-route composition, including the same site branding owner. */
export function FormSuccessPageView() {
  return (
    <LayoutInset block="xl">
      <LayoutContainer size="form">
        <LayoutStack gap="md">
          <LayoutStack align="center">
            <SiteLogo height={24} />
          </LayoutStack>
          <SectionCard padding="lg">
            <FormSubmissionSuccessState />
          </SectionCard>
        </LayoutStack>
      </LayoutContainer>
    </LayoutInset>
  );
}
