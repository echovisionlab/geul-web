import { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { PostSpotlightLauncher } from '@/features/post/PostSpotlight/PostSpotlightLauncher';
import { Shell } from '@/features/shell/Shell';
import { readUserDisplaySnapshotFromCookie } from '@/lib/auth/user-display-cookie';

export default async function GeneralLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
  const userSnapshot = readUserDisplaySnapshotFromCookie(cookieHeader);

  // Server-rendered shell (client islands for interaction); search loads on first use.
  return (
    <>
      <Shell initialUserSnapshot={userSnapshot}>{children}</Shell>
      <PostSpotlightLauncher />
    </>
  );
}
