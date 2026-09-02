import { notFound } from 'next/navigation';
import { SeriesDetail } from '@/features/series/SeriesDetail';
import { getSeriesWithManagers } from '@/lib/queries/series';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MySeriesDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getSeriesWithManagers(id);

  if (!data || !data.series) {
    notFound();
  }

  return <SeriesDetail initialData={data} scope="my" />;
}
