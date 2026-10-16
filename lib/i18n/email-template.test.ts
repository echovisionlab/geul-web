import { describe, expect, it } from 'vitest';
import { resolveSystemEmailEventKey } from './email-template';

describe('resolveSystemEmailEventKey', () => {
  it.each(['account_deletion_confirm', 'login_code', 'terms_effective'])(
    'recognizes the canonical %s event',
    (eventKey) => {
      expect(resolveSystemEmailEventKey(eventKey)).toBe(eventKey);
    },
  );

  it.each([undefined, null, '', 'account_deletion', ' Account_deletion_confirm ', 'custom_event'])(
    'rejects an unknown or missing event %s',
    (eventKey) => {
      expect(resolveSystemEmailEventKey(eventKey)).toBeNull();
    },
  );
});
