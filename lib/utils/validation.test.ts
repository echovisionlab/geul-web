import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidUuid, toUserRole } from './validation';

const mocks = vi.hoisted(() => ({
  error: vi.fn(),
}));

vi.mock('./logger', () => ({
  createLogger: () => mocks,
}));

describe('validation utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates UUID strings', () => {
    expect(isValidUuid('019efc7d-0620-7281-9627-5e1877a8445c')).toBe(true);
    expect(isValidUuid('019EFC7D-0620-7281-9627-5E1877A8445C')).toBe(false);
    expect(isValidUuid('019efc7d0620728196275e1877a8445c')).toBe(false);
    expect(isValidUuid('not-a-uuid')).toBe(false);
  });

  it('returns null for absent user roles', () => {
    expect(toUserRole(null)).toBeNull();
    expect(toUserRole(undefined)).toBeNull();
  });

  it('returns valid user roles unchanged', () => {
    expect(toUserRole('admin')).toBe('admin');
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it('falls back to user and logs invalid roles', () => {
    expect(toUserRole('owner', 'user-1')).toBe('user');
    expect(mocks.error).toHaveBeenCalledWith('Invalid user role detected, falling back to user', {
      data: { invalidRole: 'owner', memberId: 'user-1' },
      error: expect.any(Error),
    });
  });
});
