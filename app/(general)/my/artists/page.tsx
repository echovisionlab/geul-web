import { redirect } from 'next/navigation';
import { MyArtistsTable } from '@/features/my/MyArtistsTable';
import { listMyArtistsAction } from '@/lib/actions/artist';
import { getMemberId } from '@/lib/utils/session.server';

export default async function MyArtistsPage() {
  const memberId = await getMemberId();
  if (!memberId) {
    redirect('/login');
  }

  const initialData = await listMyArtistsAction({
    page: 1,
    pageSize: 20,
  });

  return <MyArtistsTable initialData={initialData} />;
}
