import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TermsEditPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/terms/history/${encodeURIComponent(id)}?edit=true`);
}
