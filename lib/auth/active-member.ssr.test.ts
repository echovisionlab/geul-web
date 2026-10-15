import { expect, it } from 'vitest';
import { getActiveMember, syncActiveMember } from './active-member';

it('never records a member while rendering on the server, where requests of many members share the process', () => {
  expect(typeof window).toBe('undefined');
  expect(syncActiveMember('member-a')).toBe('unchanged');
  expect(syncActiveMember('member-b')).toBe('unchanged');
  expect(getActiveMember()).toBeNull();
});
