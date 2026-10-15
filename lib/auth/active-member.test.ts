// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import {
  announceSignOut,
  getActiveMember,
  resetActiveMemberForTests,
  subscribeSignedOutMembers,
  syncActiveMember,
} from './active-member';

afterEach(() => resetActiveMemberForTests());

it('adopts the first member, keeps it through a lost session and reports any other member as a switch', () => {
  expect(getActiveMember()).toBeNull();
  expect(syncActiveMember('member-a')).toBe('adopted');
  expect(syncActiveMember('member-a')).toBe('unchanged');
  // A null session never reaches syncActiveMember; the member simply stays.
  expect(getActiveMember()).toBe('member-a');
  expect(syncActiveMember('member-b')).toBe('switched');
  expect(getActiveMember()).toBe('member-a');
});

it('ends a member for this page on sign-out, even when the same page later sees another member', () => {
  syncActiveMember('member-a');
  const ended = vi.fn();
  subscribeSignedOutMembers(ended);
  expect(announceSignOut()).toBe('member-a');
  expect(ended).toHaveBeenCalledWith('member-a');
  expect(getActiveMember()).toBeNull();
  // In-memory journals of member-a are still in this page: another member must reload it.
  expect(syncActiveMember('member-b')).toBe('switched');
});

it('ends the member in other tabs of this browser', async () => {
  syncActiveMember('member-a');
  const ended = vi.fn();
  subscribeSignedOutMembers(ended);
  const otherTab = new BroadcastChannel('geul:active-member:v1');
  otherTab.postMessage({ signedOut: 'member-a' });
  await vi.waitFor(() => expect(ended).toHaveBeenCalledWith('member-a'));
  expect(getActiveMember()).toBeNull();
  otherTab.close();
});
