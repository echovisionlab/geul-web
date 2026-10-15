import { FormTranslationsPanel } from '@/features/form/FormTranslationsPanel';

interface AdminFormTranslationsPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminFormTranslationsPage({ params }: AdminFormTranslationsPageProps) {
  const { id } = await params;

  return <FormTranslationsPanel formId={id} />;
}
