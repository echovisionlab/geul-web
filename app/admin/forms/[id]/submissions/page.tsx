import AdminFormSubmissionsPage from '@/features/form/AdminFormSubmissionsPage';

export default async function FormSubmissionsRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminFormSubmissionsPage formId={id} editBaseHref={`/admin/forms/${encodeURIComponent(id)}/submissions`} />;
}
