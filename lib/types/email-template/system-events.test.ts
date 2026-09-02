import { describe, expect, it } from 'vitest';
import {
  getEventVariables,
  SYSTEM_EMAIL_EVENT_KEYS,
  SYSTEM_EMAIL_EVENTS,
} from '@/lib/types/email-template/system-events';

describe('system email event catalog', () => {
  it('uses provider-neutral canonical keys for login and registration code mail', () => {
    expect(SYSTEM_EMAIL_EVENT_KEYS).not.toContain('kratos_login_code_valid');
    expect(SYSTEM_EMAIL_EVENT_KEYS).not.toContain('kratos_registration_code_valid');
    expect(SYSTEM_EMAIL_EVENTS).not.toHaveProperty('kratos_login_code_valid');
    expect(SYSTEM_EMAIL_EVENTS).not.toHaveProperty('kratos_registration_code_valid');

    expect(SYSTEM_EMAIL_EVENT_KEYS).not.toContain('kratos_login_code');
    expect(SYSTEM_EMAIL_EVENT_KEYS).not.toContain('kratos_registration_code');
    expect(SYSTEM_EMAIL_EVENT_KEYS).not.toContain('kratos_verification_code');
    expect(SYSTEM_EMAIL_EVENT_KEYS).toContain('login_code');
    expect(SYSTEM_EMAIL_EVENT_KEYS).toContain('registration_code');
    expect(SYSTEM_EMAIL_EVENT_KEYS).toContain('verification_code');
    expect(SYSTEM_EMAIL_EVENTS.login_code.urlVariable).toBeNull();
    expect(SYSTEM_EMAIL_EVENTS.registration_code.urlVariable).toBeNull();
    expect(getEventVariables('login_code')).toEqual(expect.arrayContaining(['login_code', 'expires_in_minutes']));
    expect(getEventVariables('registration_code')).toEqual(
      expect.arrayContaining(['registration_code', 'expires_in_minutes']),
    );
    expect(getEventVariables('login_code')).not.toContain('request_url');
    expect(getEventVariables('registration_code')).not.toContain('request_url');
  });

  it('matches the exact publisher-backed automatic-mail catalog', () => {
    expect(SYSTEM_EMAIL_EVENT_KEYS).toEqual([
      'account_deletion_confirm',
      'account_deletion_scheduled',
      'account_deletion_cancelled',
      'account_deletion_complete',
      'account_recovery_confirm',
      'account_recovery_complete',
      'primary_email_changed',
      'email_added',
      'email_removed',
      'passkey_added',
      'passkey_removed',
      'social_login_added',
      'social_login_removed',
      'welcome',
      'terms_update',
      'terms_effective',
      'privacy_update',
      'privacy_effective',
      'verification_code',
      'login_code',
      'registration_code',
    ]);
    expect(SYSTEM_EMAIL_EVENT_KEYS).not.toContain('email_change_verify');
    expect(SYSTEM_EMAIL_EVENT_KEYS).not.toContain('new_location_login');
  });

  it('does not expose password recovery as a system event', () => {
    expect(SYSTEM_EMAIL_EVENT_KEYS).not.toContain('recovery_code');
    expect(SYSTEM_EMAIL_EVENT_KEYS).not.toContain('kratos_recovery_code_valid');
    expect(SYSTEM_EMAIL_EVENT_KEYS).not.toContain('kratos_recovery_code');
  });

  it('does not expose Kratos anti-enumeration template types as success events', () => {
    expect(SYSTEM_EMAIL_EVENT_KEYS).not.toContain('verification_code_invalid');
    expect(SYSTEM_EMAIL_EVENT_KEYS).not.toContain('recovery_code_invalid');
  });

  it('exposes only the runtime site origin placeholder', () => {
    for (const eventKey of SYSTEM_EMAIL_EVENT_KEYS) {
      expect(getEventVariables(eventKey)).toContain('site_origin');
      expect(getEventVariables(eventKey)).not.toContain('site_url');
    }
  });
});
