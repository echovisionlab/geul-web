import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminEventSeriesDetailPage({ params }: Props) {
  await params;
  notFound();
}
