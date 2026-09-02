import type { SessionUser, SessionWithUser } from '@/lib/auth';
export interface SessionData {
  user: SessionUser;
  onboarded: boolean;
  nickname_suggestion: string | null;
}

export function toSessionData(sessionData: SessionWithUser): SessionData {
  return {
    user: {
      id: sessionData.user.id,
      nickname: sessionData.user.nickname,
      email: sessionData.user.email,
      image: sessionData.user.image,
      preferred_locale: sessionData.user.preferred_locale,
      role: sessionData.user.role,
      status: sessionData.user.status,
    },
    onboarded: sessionData.onboarded,
    nickname_suggestion: sessionData.nickname_suggestion,
  };
}
