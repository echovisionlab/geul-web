import { describe, expect, it } from 'vitest';
import { adminMemberName } from './member-name';

describe('adminMemberName', () => {
  const id = '7c1d4f3e-2a9b-4c8d-9e0f-1a2b3c4d5e6f';

  it('hides the member ID placeholder until onboarding', () => {
    expect(adminMemberName({ id, nickname: id, onboarded: false }, 'Nickname not set')).toBe('Nickname not set');
  });

  it('keeps a nickname an admin set before onboarding', () => {
    expect(adminMemberName({ id, nickname: 'Peer update', onboarded: false }, 'Nickname not set')).toBe('Peer update');
  });

  it('keeps an onboarded nickname', () => {
    expect(adminMemberName({ id, nickname: 'June', onboarded: true }, 'Nickname not set')).toBe('June');
  });
});
