import 'server-only';

import type { MemberProfile, MySection } from '@echovisionlab/geul-proto/secure/member_pb.ts';
import { createMemberClient } from '@/lib/api/server-client';

export async function getMyProfile(): Promise<MemberProfile | null> {
  const client = await createMemberClient();
  const profile = (await client.getMyProfile({})).member;
  const summary = profile?.summary;
  const nickname = summary?.nickname.trim() ?? '';
  if (!profile || !summary?.id || !nickname) {
    return null;
  }
  return profile;
}

export async function getMySections(): Promise<MySection[]> {
  const client = await createMemberClient();
  return (await client.getMySections({})).sections;
}
