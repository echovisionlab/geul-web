import { expect, it } from 'vitest';
import type { SessionWithUser } from '@/lib/auth';
import { toSessionData } from './session-data';

it('keeps the OAuth account identity out of browser session JSON', () => {
  const session = {
    account_identity_id: 'b5c20411-cd95-4eb8-8ed7-bd1a0ab83c45',
    user: {
      id: '646b433a-e294-47cf-9b40-5e368c0b0f64',
      nickname: 'Member',
      email: null,
      image: null,
      preferred_locale: null,
      role: 'author',
      status: 'active',
    },
    geo: null,
    onboarded: true,
    nickname_suggestion: null,
  } satisfies SessionWithUser;

  expect(toSessionData(session)).not.toHaveProperty('account_identity_id');
});
