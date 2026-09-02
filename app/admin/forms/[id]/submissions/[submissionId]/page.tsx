import { notFound } from 'next/navigation';
import { Divider, Stack, Title } from '@mantine/core';
import { getFormSubmissionWithSchema } from '@/lib/queries/form';
import { SubmissionDeleteButton } from '@/features/form/SubmissionDeleteButton';
import { SubmissionDetail } from '@/features/form/SubmissionDetail';

interface Props {
  params: Promise<{ id: string; submissionId: string }>;
}

export default async function AdminFormSubmissionDetailPage({ params }: Props) {
  const { id: formId, submissionId } = await params;

  const data = await getFormSubmissionWithSchema(submissionId);

  if (!data) {
    notFound();
  }

  const { submission, formSchema } = data;

  return (
    <Stack gap="md">
      <Title order={3}>Metadata</Title>
      <SubmissionDetail
        submission={submission}
        formId={formId}
        deleteButton={<SubmissionDeleteButton submissionId={submission.id} formId={formId} />}
      />

      <Divider />

      <Title order={3}>Responses</Title>
      <SubmissionDetail.Responses data={submission.data} schema={formSchema} />
    </Stack>
  );
}
