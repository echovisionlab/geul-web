'use client';

const ACCOUNT_BANNED_PATTERNS = [
  /account.*(banned|suspended|deactivated)/i,
  /(banned|suspended|deactivated).*account/i,
];

const FLOW_EXPIRED_PATTERNS = [/flow not found or expired/i, /login flow.*expired/i, /request (has )?expired/i];

type LoginMessageLike = {
  id?: number;
  text?: string | null;
};

type LoginErrorMessageKey = 'errors.accountBanned' | 'errors.flowExpired' | 'errors.generic';

function matchesAnyPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function formatLoginErrorMessage(
  input: LoginMessageLike | string | null | undefined,
  t: (key: LoginErrorMessageKey) => string,
): string {
  const text = typeof input === 'string' ? input.trim() : typeof input?.text === 'string' ? input.text.trim() : '';

  if (!text) {
    return t('errors.generic');
  }

  if (matchesAnyPattern(text, ACCOUNT_BANNED_PATTERNS)) {
    return t('errors.accountBanned');
  }

  if (matchesAnyPattern(text, FLOW_EXPIRED_PATTERNS)) {
    return t('errors.flowExpired');
  }

  return t('errors.generic');
}
