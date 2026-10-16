import { SYSTEM_EMAIL_EVENT_KEYS, type SystemEmailEvent } from '@/lib/types/email-template/system-events';

export function resolveSystemEmailEventKey(candidate?: string | null): SystemEmailEvent | null {
  if (!candidate) {
    return null;
  }

  return SYSTEM_EMAIL_EVENT_KEYS.find((eventKey) => eventKey === candidate) ?? null;
}
