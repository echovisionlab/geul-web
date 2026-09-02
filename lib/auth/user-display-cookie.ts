export const USER_DISPLAY_COOKIE_NAME = 'geul_user_display';

export interface UserDisplaySnapshot {
  name: string;
  image: string | null;
}

export function serializeUserDisplaySnapshot(snapshot: UserDisplaySnapshot): string {
  return encodeURIComponent(JSON.stringify(snapshot));
}

export function parseUserDisplaySnapshot(value: string | null | undefined): UserDisplaySnapshot | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as {
      name?: unknown;
      image?: unknown;
    };

    if (typeof parsed.name !== 'string' || parsed.name.trim().length === 0) {
      return null;
    }

    return {
      name: parsed.name,
      image: typeof parsed.image === 'string' && parsed.image.length > 0 ? parsed.image : null,
    };
  } catch {
    return null;
  }
}

export function readUserDisplaySnapshotFromCookie(cookieHeader: string): UserDisplaySnapshot | null {
  const match = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${USER_DISPLAY_COOKIE_NAME}=`));

  if (!match) {
    return null;
  }

  return parseUserDisplaySnapshot(match.slice(USER_DISPLAY_COOKIE_NAME.length + 1));
}

export function writeUserDisplaySnapshotCookie(snapshot: UserDisplaySnapshot) {
  if (typeof document === 'undefined') {
    return;
  }

  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${USER_DISPLAY_COOKIE_NAME}=${serializeUserDisplaySnapshot(snapshot)}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax${secure}`;
}

export function clearUserDisplaySnapshotCookie() {
  if (typeof document === 'undefined') {
    return;
  }

  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${USER_DISPLAY_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}
