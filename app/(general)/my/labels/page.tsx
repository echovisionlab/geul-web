import { unwrapQueryResult } from '@/lib/api/query-result';
import { redirect } from 'next/navigation';
import { MyLabelsTable } from '@/features/my/MyLabelsTable';
import { listMyLabelsAction } from '@/lib/actions/label';
import { getMemberId } from '@/lib/utils/session.server';

export default async function MyLabelsPage() {
  const memberId = await getMemberId();
  if (!memberId) {
    redirect('/login');
  }

  const initialData = await listMyLabelsAction({
    page: 1,
    pageSize: 20,
  }).then(unwrapQueryResult);

  return <MyLabelsTable initialData={initialData} />;
}
