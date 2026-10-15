/**
 * What an editor write carries to its server action: the tab origin (for self-echo suppression)
 * and the member whose edit it is. The API refuses a write whose expected member is not the
 * session's member, so a queued edit never lands under another account's session cookie, even when
 * a frozen tab missed the sign-out broadcast. Shared by browser and server code.
 */
const SEPARATOR = '.';

export function createEditorWriteToken(origin: string, memberId: string | null): string {
  return memberId ? `${origin}${SEPARATOR}${memberId}` : origin;
}

export function parseEditorWriteToken(token: string): { origin: string; expectedMember?: string } {
  const separator = token.indexOf(SEPARATOR);
  return separator < 0
    ? { origin: token }
    : { origin: token.slice(0, separator), expectedMember: token.slice(separator + 1) };
}
