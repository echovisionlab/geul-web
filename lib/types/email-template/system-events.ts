/**
 * System email events configuration
 *
 * Runtime catalog: api/internal/email/event_key.go
 *
 * Each event has:
 * - name: Display name
 * - description: What triggers this event
 * - urlVariable: Event-specific URL variable (or null if none)
 * - extraVariables: Additional variables beyond common ones (optional)
 *
 * Common variables (all events): site_name, site_origin, recipient_name
 *
 * Note: Templates must be explicitly assigned via event_key in email_template table.
 * If no template is assigned, the email will not be sent.
 */
export const SYSTEM_EMAIL_EVENTS = {
  // === Account Management ===
  account_deletion_confirm: {
    name: 'Account Deletion Confirmation',
    description: 'Sent when user requests account deletion',
    urlVariable: 'confirm_url',
    extraVariables: ['expires_in'],
  },
  account_deletion_scheduled: {
    name: 'Account Deletion Scheduled',
    description: 'Sent when account deletion is confirmed and scheduled',
    urlVariable: 'recover_url',
    extraVariables: ['scheduled_date', 'grace_period'],
  },
  account_deletion_cancelled: {
    name: 'Account Deletion Cancelled',
    description: 'Sent when user cancels account deletion',
    urlVariable: 'login_url',
  },
  account_deletion_complete: {
    name: 'Account Deletion Complete',
    description: 'Sent when account is permanently deleted',
    urlVariable: null,
  },
  account_recovery_confirm: {
    name: 'Account Recovery Confirmation',
    description: 'Sent when user requests to recover scheduled-for-deletion account',
    urlVariable: 'confirm_url',
    extraVariables: ['expires_in'],
  },
  account_recovery_complete: {
    name: 'Account Recovery Complete',
    description: 'Sent when account recovery is completed',
    urlVariable: 'login_url',
  },
  primary_email_changed: {
    name: 'Primary Email Changed',
    description: 'Sent when the account primary email changes',
    urlVariable: null,
    extraVariables: ['old_email', 'new_email'],
  },
  email_added: {
    name: 'Email Added',
    description: 'Sent when an email-code sign-in address is added',
    urlVariable: null,
    extraVariables: ['email'],
  },
  email_removed: {
    name: 'Email Removed',
    description: 'Sent when an email-code sign-in address is removed',
    urlVariable: null,
    extraVariables: ['email'],
  },
  passkey_added: {
    name: 'Passkey Added',
    description: 'Sent when a passkey is added',
    urlVariable: null,
  },
  passkey_removed: {
    name: 'Passkey Removed',
    description: 'Sent when a passkey is removed',
    urlVariable: null,
  },
  social_login_added: {
    name: 'Social Sign-in Added',
    description: 'Sent when a social sign-in is added',
    urlVariable: null,
    extraVariables: ['provider'],
  },
  social_login_removed: {
    name: 'Social Sign-in Removed',
    description: 'Sent when a social sign-in is removed',
    urlVariable: null,
    extraVariables: ['provider'],
  },
  welcome: {
    name: 'Welcome',
    description: 'Welcome email for new users on first login',
    urlVariable: 'login_url',
  },
  // === Terms & Policy ===
  terms_update: {
    name: 'Terms Update Notice',
    description: 'Sent when Terms of Service are scheduled for update',
    urlVariable: 'preview_url',
    extraVariables: ['effective_date'],
  },
  terms_effective: {
    name: 'Terms Now Effective',
    description: 'Sent when Terms of Service become effective',
    urlVariable: 'terms_url',
  },
  privacy_update: {
    name: 'Privacy Policy Update Notice',
    description: 'Sent when Privacy Policy is scheduled for update',
    urlVariable: 'preview_url',
    extraVariables: ['effective_date'],
  },
  privacy_effective: {
    name: 'Privacy Policy Now Effective',
    description: 'Sent when Privacy Policy becomes effective',
    urlVariable: 'privacy_url',
  },

  // === Authentication ===
  verification_code: {
    name: 'Email Verification Code',
    description: 'Sent with a code to verify an email address',
    urlVariable: 'verification_url',
    extraVariables: ['verification_code', 'expires_in_minutes', 'to', 'identity_email'],
  },
  login_code: {
    name: 'Login Code Email',
    description: 'Sent with a code for an existing account to sign in',
    urlVariable: null,
    extraVariables: ['login_code', 'expires_in_minutes', 'to', 'identity_email'],
  },
  registration_code: {
    name: 'Registration Code Email',
    description: 'Sent with a code to verify an email before creating an account',
    urlVariable: null,
    extraVariables: ['registration_code', 'expires_in_minutes', 'to'],
  },
} as const;

export type SystemEmailEvent = keyof typeof SYSTEM_EMAIL_EVENTS;

export const SYSTEM_EMAIL_EVENT_KEYS = Object.keys(SYSTEM_EMAIL_EVENTS) as SystemEmailEvent[];

/**
 * Variable descriptions for UI display
 */
export const VARIABLE_DESCRIPTIONS: Record<string, string> = {
  // Common
  name: 'Name',
  site_name: 'Site name',
  site_origin: 'Runtime site origin',
  logo_email_url: 'Email-specific logo URL from site settings (if set)',
  recipient_name: "Recipient's name (may be empty)",
  recipient_email: 'Recipient email address',

  // Account Management
  confirm_url: 'Confirmation link',
  confirm_link: 'Confirmation link',
  expires_in: 'Link expiration time (e.g., "24 hours")',
  expires_in_hours: 'Link expiration time in hours',
  recover_url: 'Account recovery link',
  cancel_url: 'Cancellation link',
  scheduled_date: 'Scheduled deletion date',
  grace_period: 'Days until permanent deletion',
  login_url: 'Login page link',
  old_email: 'Previous email address',
  new_email: 'New email address',
  email: 'Email address',
  provider: 'Social sign-in provider',
  verify_url: 'Subscription confirmation link',

  // Terms & Policy
  preview_url: 'Link to preview updated document',
  effective_date: 'Date when the update takes effect',
  terms_url: 'Link to view current Terms of Service',
  privacy_url: 'Link to view current Privacy Policy',

  // Authentication
  verification_url: 'Email verification link',
  verification_code: '6-digit verification code',
  expires_in_minutes: 'Code expiration time in minutes',
  login_code: '6-digit login code',
  registration_code: '6-digit registration code',
  to: 'Email recipient address',
  identity_email: 'Account email address',
  identity_name: 'Account name',
};

/**
 * Common variables available to all events
 */
const COMMON_VARIABLES = ['site_name', 'site_origin', 'recipient_name'];

/**
 * Get all variables available for a specific event
 */
export function getEventVariables(eventKey: SystemEmailEvent): string[] {
  const event = SYSTEM_EMAIL_EVENTS[eventKey];
  const variables = [...COMMON_VARIABLES];

  if (event.urlVariable) {
    variables.push(event.urlVariable);
  }

  if ('extraVariables' in event && event.extraVariables) {
    variables.push(...event.extraVariables);
  }

  return variables;
}
