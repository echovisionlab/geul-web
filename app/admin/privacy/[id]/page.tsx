import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PrivacyEditPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/privacy/history/${encodeURIComponent(id)}?edit=true`);
}
