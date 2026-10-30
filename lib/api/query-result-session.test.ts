// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { SESSION_REVALIDATE_EVENT } from '@/lib/auth/session-events';
import { unwrapQueryResult } from './query-result';

describe('Server Action query session loss', () => {
  it('asks the session provider to recheck only for a 401 result', () => {
    const listener = vi.fn();
    window.addEventListener(SESSION_REVALIDATE_EVENT, listener);
    expect(() => unwrapQueryResult({ ok: false, status: 403, error: 'Forbidden' })).toThrow('Forbidden');
    expect(listener).not.toHaveBeenCalled();
    expect(() => unwrapQueryResult({ ok: false, status: 401, error: 'Unauthorized' })).toThrow('Unauthorized');
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(SESSION_REVALIDATE_EVENT, listener);
  });
});
