/**
 * Until a member finishes onboarding, the API stores the member ID as a placeholder nickname.
 * Admin surfaces name such a member with `unset` instead of that identifier; a nickname an
 * admin set before onboarding is shown as is.
 */
export function isPlaceholderNickname(member: { id: string; nickname: string; onboarded: boolean }): boolean {
  return !member.onboarded && member.nickname === member.id;
}

export function adminMemberName(member: { id: string; nickname: string; onboarded: boolean }, unset: string): string {
  return isPlaceholderNickname(member) ? unset : member.nickname;
}
