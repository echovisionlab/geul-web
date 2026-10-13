import { listMySeries } from '@/lib/queries/series';
import { MySeriesPageView } from '@/features/my/MySeriesPageView';
export default async function MySeriesPage() {
  const items = await listMySeries();
  return <MySeriesPageView items={items} />;
}
