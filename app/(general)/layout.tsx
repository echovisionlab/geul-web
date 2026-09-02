import { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { PostSpotlight } from '@/features/post/PostSpotlight/PostSpotlight';
import { Shell } from '@/features/shell/Shell';
import { readUserDisplaySnapshotFromCookie } from '@/lib/auth/user-display-cookie';

export default async function GeneralLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
  const userSnapshot = readUserDisplaySnapshotFromCookie(cookieHeader);

  // Menus are already filtered by user role on the backend
  return (
    <>
      <Shell initialUserSnapshot={userSnapshot}>{children}</Shell>
      <PostSpotlight />
    </>
  );
}
