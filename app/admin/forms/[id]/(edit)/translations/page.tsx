import { EntityTranslationsPanel } from '@/features/translation/EntityTranslationsPanel';

interface AdminFormTranslationsPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminFormTranslationsPage({ params }: AdminFormTranslationsPageProps) {
  const { id } = await params;

  return <EntityTranslationsPanel entityType="form" entityId={id} collapsible={false} />;
}
