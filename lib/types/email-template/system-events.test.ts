import { describe, expect, it } from 'vitest';
import {
  getEventVariables,
  SYSTEM_EMAIL_EVENT_KEYS,
  SYSTEM_EMAIL_EVENTS,
} from '@/lib/types/email-template/system-events';

describe('system email event catalog', () => {
  it('uses provider-neutral canonical keys for login and registration code mail', () => {
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

  it('exposes only the runtime site origin placeholder', () => {
    for (const eventKey of SYSTEM_EMAIL_EVENT_KEYS) {
      expect(getEventVariables(eventKey)).toContain('site_origin');
    }
  });
});
