'use client';
import type { ComponentProps } from 'react';
import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Heading as DsHeading } from '@/components/core/Typography';
import { SubmissionDetail } from './SubmissionDetail';
import { SubmissionDeleteButton } from './SubmissionDeleteButton';
export interface FormSubmissionDetailPageViewProps {
  formId: string;
  submission: ComponentProps<typeof SubmissionDetail>['submission'];
  formSchema: ComponentProps<typeof SubmissionDetail.Responses>['schema'];
  deleteAction?: ComponentProps<typeof SubmissionDeleteButton>['deleteAction'];
  onDeleted?: () => void;
  returnHref?: string;
}
export function FormSubmissionDetailPageView({
  formId,
  submission,
  formSchema,
  deleteAction,
  onDeleted,
  returnHref,
}: FormSubmissionDetailPageViewProps) {
  return (
    <DsLayoutStack gap="md">
      <DsHeading level={3}>Metadata</DsHeading>
      <SubmissionDetail
        submission={submission}
        formId={formId}
        deleteButton={
          <SubmissionDeleteButton
            submissionId={submission.id}
            formId={formId}
            deleteAction={deleteAction}
            onDeleted={onDeleted}
            returnHref={returnHref}
          />
        }
      />

      <DsHeading level={3}>Responses</DsHeading>
      <SubmissionDetail.Responses data={submission.data} schema={formSchema} />
    </DsLayoutStack>
  );
}
