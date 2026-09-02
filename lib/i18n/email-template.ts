import { SYSTEM_EMAIL_EVENT_KEYS, type SystemEmailEvent } from '@/lib/types/email-template/system-events';

type SystemEmailEventMessageKey = `${SystemEmailEvent}.${'name' | 'description'}`;

type EmailVariableDescriptionMessageKey =
  | 'name'
  | 'site_name'
  | 'site_origin'
  | 'logo_email_url'
  | 'recipient_name'
  | 'recipient_email'
  | 'confirm_url'
  | 'expires_in'
  | 'expires_in_hours'
  | 'recover_url'
  | 'cancel_url'
  | 'scheduled_date'
  | 'grace_period'
  | 'login_url'
  | 'old_email'
  | 'new_email'
  | 'email'
  | 'provider'
  | 'verify_url'
  | 'preview_url'
  | 'effective_date'
  | 'terms_url'
  | 'privacy_url'
  | 'verification_url'
  | 'verification_code'
  | 'expires_in_minutes'
  | 'login_code'
  | 'registration_code'
  | 'to'
  | 'identity_email'
  | 'identity_name';

function resolveEmailVariableDescriptionMessageKey(variableName: string): EmailVariableDescriptionMessageKey | null {
  if (variableName === 'confirm_link') {
    return 'confirm_url';
  }

  switch (variableName) {
    case 'name':
    case 'site_name':
    case 'site_origin':
    case 'logo_email_url':
    case 'recipient_name':
    case 'recipient_email':
    case 'confirm_url':
    case 'expires_in':
    case 'expires_in_hours':
    case 'recover_url':
    case 'cancel_url':
    case 'scheduled_date':
    case 'grace_period':
    case 'login_url':
    case 'old_email':
    case 'new_email':
    case 'email':
    case 'provider':
    case 'verify_url':
    case 'preview_url':
    case 'effective_date':
    case 'terms_url':
    case 'privacy_url':
    case 'verification_url':
    case 'verification_code':
    case 'expires_in_minutes':
    case 'login_code':
    case 'registration_code':
    case 'to':
    case 'identity_email':
    case 'identity_name':
      return variableName;
    default:
      return null;
  }
}

export function resolveSystemEmailEventKey(candidate?: string | null): SystemEmailEvent | null {
  if (!candidate) {
    return null;
  }

  return SYSTEM_EMAIL_EVENT_KEYS.find((eventKey) => eventKey === candidate) ?? null;
}

export function getLocalizedSystemEmailEvent(
  t: (key: SystemEmailEventMessageKey) => string,
  eventKey: SystemEmailEvent,
) {
  return {
    name: t(`${eventKey}.name`),
    description: t(`${eventKey}.description`),
  };
}

export function getLocalizedEmailVariableDescription(
  t: (key: EmailVariableDescriptionMessageKey) => string,
  variableName: string,
): string | null {
  const normalizedName = variableName.trim().toLowerCase();
  const lookupKey = resolveEmailVariableDescriptionMessageKey(normalizedName);

  if (!lookupKey) {
    return null;
  }

  return t(lookupKey);
}
