import { notFound } from 'next/navigation';

import { getFormSubmissionWithSchema } from '@/lib/queries/form';
import { FormSubmissionDetailPageView } from '@/features/form/FormSubmissionDetailPageView';

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

  return <FormSubmissionDetailPageView formId={formId} submission={submission} formSchema={formSchema} />;
}
